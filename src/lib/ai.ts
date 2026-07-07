import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { getEnv, isAiTriageConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { AiTriageResult, NormalizedEvent } from "@/types/events";

const triageSchema = z.object({
  summary: z.string().min(1).max(400),
  suggestedLabels: z.array(z.string().min(1).max(30)).max(5),
  priority: z.enum(["low", "medium", "high"]),
  reasoning: z.string().min(1).max(400),
});

const SYSTEM_INSTRUCTION = `You are a triage assistant for a GitHub automation bot. Given an issue or
pull request's title and body, respond with ONLY a JSON object — no markdown
fences, no prose before or after — matching exactly this shape:
{"summary": string, "suggestedLabels": string[], "priority": "low"|"medium"|"high", "reasoning": string}

Rules:
- summary: one or two plain sentences a maintainer could read in a Slack
  notification to understand the issue/PR without opening it.
- suggestedLabels: 0-3 short, lowercase, kebab-case labels (e.g. "bug",
  "needs-repro", "good-first-issue"). Only suggest labels that are clearly
  warranted by the content — an empty array is a valid, good answer.
- priority: "high" for crashes, security issues, data loss, or broken CI;
  "medium" for real bugs or clearly-scoped feature work; "low" for
  questions, minor polish, or unclear/low-effort reports.
- reasoning: one sentence on why you picked that priority.
Never invent details not present in the title/body.`;

/**
 * Runs Gemini triage on an issue/PR. Returns `null` (never throws) when:
 *  - GEMINI_API_KEY isn't configured (AI triage is an optional stretch
 *    goal; the bot must fully function without it)
 *  - the API call fails (network, quota, etc.)
 *  - the model's response isn't valid JSON matching our schema
 * In every "degrade" case we log why, so it's visible on the dashboard's
 * event detail and in structured logs — never a silent swallow.
 */
export async function runAiTriage(event: NormalizedEvent): Promise<AiTriageResult | null> {
  if (event.eventType !== "issues" && event.eventType !== "pull_request") return null;
  if (!isAiTriageConfigured()) return null;

  const env = getEnv();

  try {
    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY as string);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: SYSTEM_INSTRUCTION,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
        maxOutputTokens: 400,
      },
    });

    const prompt = [
      `Type: ${event.eventType}`,
      `Title: ${event.title ?? "(none)"}`,
      `Body: ${(event.body ?? "").slice(0, 4000) || "(empty)"}`,
      `Existing labels: ${(event.existingLabels ?? []).join(", ") || "(none)"}`,
    ].join("\n");

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const parsed = triageSchema.safeParse(JSON.parse(text));
    if (!parsed.success) {
      logger.warn("ai_triage_schema_mismatch", {
        deliveryId: event.deliveryId,
        issues: parsed.error.issues.map((i) => i.message).join("; "),
      });
      return null;
    }

    return parsed.data;
  } catch (err) {
    logger.warn("ai_triage_failed", {
      deliveryId: event.deliveryId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
