import { z } from "zod";

/**
 * All environment variables are read through this module. Two benefits over
 * scattering `process.env.X` everywhere:
 *  1. A misconfigured deployment fails at startup with a readable error
 *     instead of failing confusingly deep inside a webhook handler.
 *  2. It's the one place that knows which vars are optional (AI triage,
 *     for example, is designed to degrade gracefully if GEMINI_API_KEY is
 *     absent), so that decision isn't duplicated across call sites.
 */
const serverEnvSchema = z.object({
  APP_URL: z.string().url(),
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(16, "NEXTAUTH_SECRET must be set and non-trivial"),

  DATABASE_URL: z.string().min(1),
  DATABASE_URL_UNPOOLED: z.string().min(1),

  GITHUB_APP_ID: z.string().min(1),
  GITHUB_APP_CLIENT_ID: z.string().min(1),
  GITHUB_APP_CLIENT_SECRET: z.string().min(1),
  GITHUB_APP_WEBHOOK_SECRET: z.string().min(1),
  GITHUB_APP_PRIVATE_KEY: z.string().min(1),
  GITHUB_APP_SLUG: z.string().min(1),

  SLACK_BOT_TOKEN: z.string().optional(),
  SLACK_CHANNEL_ID: z.string().optional(),

  GEMINI_API_KEY: z.string().optional(),

  CRON_SECRET: z.string().min(1),
});

type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

export function getEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid or missing environment variables:\n${issues}\n\nCopy .env.example to .env and fill in real values.`
    );
  }

  cached = parsed.data;
  return cached;
}

/** Normalizes the private key: supports both literal newlines and escaped \n. */
export function getGithubPrivateKey(): string {
  const key = getEnv().GITHUB_APP_PRIVATE_KEY;
  return key.includes("\\n") ? key.replace(/\\n/g, "\n") : key;
}

export function isSlackConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.SLACK_BOT_TOKEN && env.SLACK_CHANNEL_ID);
}

export function isAiTriageConfigured(): boolean {
  return Boolean(getEnv().GEMINI_API_KEY);
}
