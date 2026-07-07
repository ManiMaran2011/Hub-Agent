import { prisma } from "@/lib/db";
import { getInstallationOctokit } from "@/lib/github/app";
import { logger } from "@/lib/logger";

/**
 * Pulls every repository the installation currently has access to and
 * upserts it locally. Called right after a user completes the "Install"
 * flow, and again whenever GitHub tells us (via `installation_repositories`
 * webhook) that the set of granted repos changed.
 */
export async function syncInstallationRepositories(installationDbId: string, installationGithubId: number) {
  const octokit = await getInstallationOctokit(installationGithubId);

  const repos = await octokit.paginate(octokit.rest.apps.listReposAccessibleToInstallation, {
    per_page: 100,
  });

  for (const repo of repos) {
    await prisma.repository.upsert({
      where: { githubRepoId: repo.id },
      update: {
        name: repo.name,
        fullName: repo.full_name,
        defaultBranch: repo.default_branch ?? "main",
        private: repo.private,
        htmlUrl: repo.html_url,
        installationId: installationDbId,
      },
      create: {
        githubRepoId: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        defaultBranch: repo.default_branch ?? "main",
        private: repo.private,
        htmlUrl: repo.html_url,
        installationId: installationDbId,
      },
    });
  }

  logger.info("installation_repos_synced", {
    installationGithubId,
    count: repos.length,
  });

  return repos.length;
}

/**
 * Best-effort handling of the `installation` webhook event. We can only
 * safely associate an installation with one of our users at the moment
 * the *user* completes the install flow through our own callback (where
 * we have their authenticated session) — not from the webhook alone,
 * which carries no notion of "which of our users clicked this". So:
 *  - if the Installation row already exists (normal case: user went
 *    through /api/github/install first), keep it in sync.
 *  - if it doesn't exist yet, log and skip — the callback route will
 *    create it moments later when the browser redirect completes.
 * This is a deliberate, documented limitation (see README) rather than
 * a guess at ownership.
 */
export async function handleInstallationWebhookEvent(action: string, payload: any) {
  const githubInstallationId = payload.installation?.id;
  if (!githubInstallationId) return;

  const existing = await prisma.installation.findUnique({
    where: { githubInstallationId },
  });

  if (action === "deleted") {
    if (existing) {
      await prisma.installation.delete({ where: { id: existing.id } });
      logger.info("installation_deleted", { githubInstallationId });
    }
    return;
  }

  if (action === "suspend" || action === "unsuspend") {
    if (existing) {
      await prisma.installation.update({
        where: { id: existing.id },
        data: { suspended: action === "suspend" },
      });
    }
    return;
  }

  if (!existing) {
    logger.warn("installation_webhook_before_callback", { githubInstallationId, action });
    return;
  }

  if (action === "created" || action === "unsuspend") {
    await syncInstallationRepositories(existing.id, githubInstallationId);
  }
}

export async function handleInstallationRepositoriesWebhookEvent(payload: any) {
  const githubInstallationId = payload.installation?.id;
  if (!githubInstallationId) return;

  const existing = await prisma.installation.findUnique({ where: { githubInstallationId } });
  if (!existing) {
    logger.warn("installation_repos_webhook_before_callback", { githubInstallationId });
    return;
  }

  await syncInstallationRepositories(existing.id, githubInstallationId);

  // Repos explicitly removed from the installation should stop showing up
  // even if listReposAccessibleToInstallation pagination raced the removal.
  const removed: any[] = payload.repositories_removed ?? [];
  for (const repo of removed) {
    await prisma.repository.deleteMany({ where: { githubRepoId: repo.id } });
  }
}
