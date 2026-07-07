import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Sign-in uses the *GitHub App's* OAuth client id/secret. GitHub Apps
 * expose the same `/login/oauth/authorize` + `/login/oauth/access_token`
 * endpoints as classic OAuth Apps for "user-to-server" tokens, so
 * next-auth's stock GitHub provider works unmodified — we just point it
 * at the App's credentials instead of a separate OAuth App's. This is
 * deliberate: one GitHub integration handles login, repo connection, and
 * webhooks, instead of maintaining two.
 *
 * Session strategy is JWT (no database adapter): the dashboard only needs
 * to know *who* is signed in, and that identity is cheap to carry in a
 * signed cookie. The heavier, relational data (installations, repos,
 * rules, events) lives in Postgres and is looked up by the user's id.
 */
export function buildAuthOptions(): NextAuthOptions {
  const env = getEnv();

  return {
    providers: [
      GitHubProvider({
        clientId: env.GITHUB_APP_CLIENT_ID,
        clientSecret: env.GITHUB_APP_CLIENT_SECRET,
        authorization: { params: { scope: "" } }, // GitHub App permissions come from the App config, not OAuth scopes
        profile(profile) {
          return {
            id: String(profile.id),
            name: profile.name ?? profile.login,
            email: profile.email,
            image: profile.avatar_url,
            login: profile.login,
          } as any;
        },
      }),
    ],
    secret: env.NEXTAUTH_SECRET,
    session: { strategy: "jwt" },
    pages: { signIn: "/login" },
    callbacks: {
      async jwt({ token, profile, account }) {
        if (profile && account) {
          const gh = profile as any;
          const user = await prisma.user.upsert({
            where: { githubId: gh.id },
            update: {
              login: gh.login,
              name: gh.name ?? gh.login,
              avatarUrl: gh.avatar_url,
              email: gh.email ?? undefined,
              accessToken: account.access_token ?? undefined,
            },
            create: {
              githubId: gh.id,
              login: gh.login,
              name: gh.name ?? gh.login,
              avatarUrl: gh.avatar_url,
              email: gh.email ?? undefined,
              accessToken: account.access_token ?? undefined,
            },
          });
          token.userId = user.id;
          token.login = user.login;
          logger.info("user_signed_in", { userId: user.id, login: user.login });
        }
        return token;
      },
      async session({ session, token }) {
        if (session.user) {
          (session.user as any).id = token.userId as string;
          (session.user as any).login = token.login as string;
        }
        return session;
      },
    },
  };
}
