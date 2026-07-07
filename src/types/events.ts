export type SupportedEventType = "issues" | "pull_request" | "push";

export interface NormalizedRepo {
  githubRepoId: number;
  name: string;
  fullName: string;
  htmlUrl: string;
  defaultBranch: string;
  private: boolean;
}

/**
 * A trimmed, stable projection of the (much larger) raw GitHub webhook
 * payload. We deliberately don't store the raw payload verbatim:
 *  - it can be large and mostly irrelevant to what the bot acts on
 *  - a stable shape means the rules engine and AI triage don't need to
 *    know about `issues` vs `pull_request` payload differences
 */
export interface NormalizedEvent {
  eventType: SupportedEventType;
  action: string | null; // "opened", "closed", "synchronize", null for push
  deliveryId: string;
  installationId: number;
  repo: NormalizedRepo;
  sender: { login: string; htmlUrl: string };

  // Present for issues / pull_request
  number?: number;
  title?: string;
  body?: string;
  htmlUrl?: string;
  author?: string;
  existingLabels?: string[];

  // Present for push
  ref?: string; // e.g. "refs/heads/main"
  branch?: string;
  commitCount?: number;
  commitMessages?: string[];
  pusher?: string;
}

export interface RuleCondition {
  field: "title" | "body" | "author" | "label" | "branch";
  op: "contains" | "equals" | "startsWith";
  value: string;
  caseSensitive?: boolean;
}

export type RuleAction =
  | { type: "add_label"; label: string }
  | { type: "comment"; template: string }
  | { type: "slack_notify"; template: string };

export interface AiTriageResult {
  summary: string;
  suggestedLabels: string[];
  priority: "low" | "medium" | "high";
  reasoning: string;
}
