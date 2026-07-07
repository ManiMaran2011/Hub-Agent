export interface DashboardActionLog {
  id: string;
  type: "add_label" | "comment" | "slack_notify";
  status: "pending" | "success" | "failed";
  detail: Record<string, unknown>;
  error: string | null;
}

export interface DashboardEvent {
  id: string;
  deliveryId: string;
  eventType: string;
  action: string | null;
  status: "pending" | "processing" | "success" | "partial" | "failed" | "ignored";
  payload: {
    title?: string;
    body?: string;
    htmlUrl?: string;
    author?: string;
    number?: number;
    branch?: string;
    commitCount?: number;
    sender?: { login: string };
  };
  matchedRules: { id: string; name: string }[] | null;
  aiTriage: {
    summary: string;
    suggestedLabels: string[];
    priority: "low" | "medium" | "high";
    reasoning: string;
  } | null;
  retryCount: number;
  lastError: string | null;
  createdAt: string;
  repository: { id: string; fullName: string; htmlUrl: string } | null;
  actionLogs: DashboardActionLog[];
}
