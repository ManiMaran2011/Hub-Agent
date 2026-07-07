import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import { getEnv, getGithubPrivateKey } from "@/lib/env";

/**
 * Why a GitHub App instead of a plain OAuth App:
 *  - Installation tokens are scoped to exactly the repos the user granted,
 *    and expire in an hour, vs. an OAuth-app personal token that's
 *    typically broader and longer-lived.
 *  - The same App handles user login (via its OAuth endpoints, which are
 *    identical in shape to a classic OAuth App's) *and* repo access *and*
 *    webhooks — one integration instead of two.
 *  - It's the mechanism GitHub itself recommends for anything that acts on
 *    a user's behalf against their repos long-term.
 *
 * @octokit/auth-app handles JWT construction (RS256, iss=app id, short
 * exp) and installation-token exchange/caching internally, so this module
 * is mostly a thin, typed wrapper plus our own client cache to avoid
 * re-authenticating on every single call within one request lifecycle.
 */

const clientCache = new Map<number, { octokit: Octokit; expiresAt: number }>();

export function getAppOctokit(): Octokit {
  const env = getEnv();
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: env.GITHUB_APP_ID,
      privateKey: getGithubPrivateKey(),
    },
  });
}

/**
 * Returns an Octokit instance authenticated as a specific installation
 * (i.e. scoped to the repos that installation was granted). Cached for
 * ~50 minutes (installation tokens live 60 minutes) to cut down on token
 * exchange calls when a single request touches multiple repos/actions.
 */
export async function getInstallationOctokit(installationId: number): Promise<Octokit> {
  const cached = clientCache.get(installationId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.octokit;
  }

  const env = getEnv();
  const octokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: env.GITHUB_APP_ID,
      privateKey: getGithubPrivateKey(),
      installationId,
    },
  });

  // Force an immediate auth so failures (revoked installation, bad key)
  // surface here rather than on the first real API call downstream.
  await octokit.auth({ type: "installation" });

  clientCache.set(installationId, {
    octokit,
    expiresAt: Date.now() + 50 * 60 * 1000,
  });

  return octokit;
}

export function getInstallationUrl(): string {
  const env = getEnv();
  return `https://github.com/apps/${env.GITHUB_APP_SLUG}/installations/new`;
}
