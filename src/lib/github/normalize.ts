import type { NormalizedEvent, NormalizedRepo, SupportedEventType } from "@/types/events";

export const SUPPORTED_EVENT_TYPES: readonly SupportedEventType[] = [
  "issues",
  "pull_request",
  "push",
];

export function isSupportedEventType(x: string): x is SupportedEventType {
  return (SUPPORTED_EVENT_TYPES as readonly string[]).includes(x);
}

function extractRepo(payload: any): NormalizedRepo {
  const r = payload.repository;
  return {
    githubRepoId: r.id,
    name: r.name,
    fullName: r.full_name,
    htmlUrl: r.html_url,
    defaultBranch: r.default_branch ?? "main",
    private: Boolean(r.private),
  };
}

/**
 * Converts a raw GitHub webhook body into our stable NormalizedEvent shape.
 * Returns `null` for event/action combinations we don't act on (e.g. an
 * `issues` event with action `deleted`) so callers can short-circuit to
 * `ignored` without running rules or AI triage against nothing useful.
 */
export function normalizeGithubEvent(
  eventType: SupportedEventType,
  deliveryId: string,
  installationId: number,
  payload: any
): NormalizedEvent | null {
  const repo = extractRepo(payload);
  const sender = {
    login: payload.sender?.login ?? "unknown",
    htmlUrl: payload.sender?.html_url ?? "",
  };

  if (eventType === "issues") {
    const actionable = ["opened", "edited", "reopened"];
    if (!actionable.includes(payload.action)) return null;
    const issue = payload.issue;
    return {
      eventType,
      action: payload.action,
      deliveryId,
      installationId,
      repo,
      sender,
      number: issue.number,
      title: issue.title,
      body: issue.body ?? "",
      htmlUrl: issue.html_url,
      author: issue.user?.login,
      existingLabels: (issue.labels ?? []).map((l: any) => l.name),
    };
  }

  if (eventType === "pull_request") {
    const actionable = ["opened", "edited", "reopened", "synchronize", "ready_for_review"];
    if (!actionable.includes(payload.action)) return null;
    const pr = payload.pull_request;
    return {
      eventType,
      action: payload.action,
      deliveryId,
      installationId,
      repo,
      sender,
      number: pr.number,
      title: pr.title,
      body: pr.body ?? "",
      htmlUrl: pr.html_url,
      author: pr.user?.login,
      existingLabels: (pr.labels ?? []).map((l: any) => l.name),
      branch: pr.head?.ref,
    };
  }

  if (eventType === "push") {
    // Ignore branch deletions (payload.deleted) and tag pushes — nothing
    // meaningful for the rules engine to act on there.
    if (payload.deleted || !payload.ref?.startsWith("refs/heads/")) return null;
    const branch = payload.ref.replace("refs/heads/", "");
    const commits = Array.isArray(payload.commits) ? payload.commits : [];
    return {
      eventType,
      action: null,
      deliveryId,
      installationId,
      repo,
      sender,
      ref: payload.ref,
      branch,
      commitCount: commits.length,
      commitMessages: commits.slice(0, 10).map((c: any) => c.message),
      pusher: payload.pusher?.name,
    };
  }

  return null;
}
