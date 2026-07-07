import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { buildAuthOptions } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { prisma } from "@/lib/db";
import { getAppOctokit } from "@/lib/github/app";
import { syncInstallationRepositories } from "@/lib/github/installations";
import { logger } from "@/lib/logger";

/**
 * GitHub redirects here after the user installs (or updates) the App,
 * with `installation_id` and `setup_action` query params. This is where
 * we learn *which* of our users just connected a repo — via their active
 * session in this same browser — and create the Installation row
 * accordingly (see lib/github/installations.ts for why this can't be
 * inferred from the webhook alone).
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(buildAuthOptions());
  const env = getEnv();

  if (!session?.user) {
    const loginUrl = new URL("/login", env.APP_URL);
    loginUrl.searchParams.set("callbackUrl", "/api/github/install");
    return NextResponse.redirect(loginUrl);
  }

  const installationIdParam = request.nextUrl.searchParams.get("installation_id");
  const setupAction = request.nextUrl.searchParams.get("setup_action");

  if (!installationIdParam) {
    return NextResponse.redirect(new URL("/dashboard/repos?error=missing_installation_id", env.APP_URL));
  }

  const githubInstallationId = Number(installationIdParam);

  if (setupAction === "request") {
    // Org owner approval required before the installation is active yet.
    return NextResponse.redirect(new URL("/dashboard/repos?pending=1", env.APP_URL));
  }

  try {
    const appOctokit = getAppOctokit();
    const { data: installation } = await appOctokit.rest.apps.getInstallation({
      installation_id: githubInstallationId,
    });

    const account = installation.account as any;

    const record = await prisma.installation.upsert({
      where: { githubInstallationId },
      update: {
        accountLogin: account?.login ?? account?.name ?? "unknown",
        accountType: account?.type ?? "User",
        targetType: installation.target_type,
        userId: session.user.id,
        suspended: false,
      },
      create: {
        githubInstallationId,
        accountLogin: account?.login ?? account?.name ?? "unknown",
        accountType: account?.type ?? "User",
        targetType: installation.target_type,
        userId: session.user.id,
      },
    });

    const repoCount = await syncInstallationRepositories(record.id, githubInstallationId);

    logger.info("installation_connected", {
      userId: session.user.id,
      githubInstallationId,
      repoCount,
    });

    return NextResponse.redirect(new URL("/dashboard/repos?connected=1", env.APP_URL));
  } catch (err) {
    logger.error("installation_callback_failed", {
      githubInstallationId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.redirect(new URL("/dashboard/repos?error=connect_failed", env.APP_URL));
  }
}
