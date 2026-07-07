import { getInstallationOctokit } from "@/lib/github/app";
import type { NormalizedEvent } from "@/types/events";

/**
 * Adding a label GitHub already has on the issue is a harmless no-op on
 * GitHub's side, but we still short-circuit locally so a retried event
 * doesn't make a redundant API call against a rate-limited resource.
 */
export async function addLabel(event: NormalizedEvent, label: string): Promise<void> {
  if (!event.number) throw new Error("addLabel requires an issue/PR number");
  if (event.existingLabels?.includes(label)) return;

  const { owner, repo } = splitFullName(event.repo.fullName);
  const octokit = await getInstallationOctokit(event.installationId);
  await octokit.rest.issues.addLabels({
    owner,
    repo,
    issue_number: event.number,
    labels: [label],
  });
}

export async function postComment(event: NormalizedEvent, body: string): Promise<void> {
  if (!event.number) throw new Error("postComment requires an issue/PR number");

  const { owner, repo } = splitFullName(event.repo.fullName);
  const octokit = await getInstallationOctokit(event.installationId);
  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: event.number,
    body,
  });
}

function splitFullName(fullName: string): { owner: string; repo: string } {
  const [owner, repo] = fullName.split("/");
  if (!owner || !repo) {
    throw new Error(`Malformed repository full name: "${fullName}"`);
  }
  return { owner, repo };
}
