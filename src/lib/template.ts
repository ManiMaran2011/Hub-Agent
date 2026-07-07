import type { AiTriageResult, NormalizedEvent } from "@/types/events";

/**
 * Deliberately not a full templating engine (no loops/conditionals) — the
 * rule editor only needs variable substitution for comment/Slack message
 * bodies, and a minimal implementation here means no injection surface
 * beyond plain string replacement.
 */
export function renderTemplate(
  template: string,
  event: NormalizedEvent,
  ai: AiTriageResult | null
): string {
  const vars: Record<string, string> = {
    title: event.title ?? "",
    author: event.author ?? event.sender.login,
    repo: event.repo.fullName,
    url: event.htmlUrl ?? event.repo.htmlUrl,
    number: event.number ? String(event.number) : "",
    branch: event.branch ?? "",
    ai_summary: ai?.summary ?? "",
    ai_priority: ai?.priority ?? "",
  };

  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_match, key: string) => {
    return vars[key.toLowerCase()] ?? "";
  });
}

export const AVAILABLE_TEMPLATE_VARS = [
  "title",
  "author",
  "repo",
  "url",
  "number",
  "branch",
  "ai_summary",
  "ai_priority",
] as const;
