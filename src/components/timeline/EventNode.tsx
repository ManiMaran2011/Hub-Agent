"use client";

import { useState } from "react";
import clsx from "clsx";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ActionRow } from "@/components/timeline/ActionRow";
import type { DashboardEvent } from "@/types/dashboard";

const DOT_COLOR: Record<DashboardEvent["status"], string> = {
  pending: "bg-signal-info",
  processing: "bg-signal-info",
  success: "bg-signal-success",
  partial: "bg-signal-retry",
  failed: "bg-signal-fail",
  ignored: "bg-ink-faint",
};

const PRIORITY_COLOR: Record<string, string> = {
  high: "text-signal-fail",
  medium: "text-signal-retry",
  low: "text-signal-success",
};

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function eventHeadline(event: DashboardEvent): string {
  if (event.payload.title) return event.payload.title;
  if (event.eventType === "push") {
    return `push to ${event.payload.branch ?? "?"} · ${event.payload.commitCount ?? 0} commit${
      event.payload.commitCount === 1 ? "" : "s"
    }`;
  }
  return `${event.eventType}${event.action ? `.${event.action}` : ""}`;
}

export function EventNode({
  event,
  isLast,
  onChanged,
}: {
  event: DashboardEvent;
  isLast: boolean;
  onChanged: (updated: DashboardEvent) => void;
}) {
  const [retrying, setRetrying] = useState(false);

  async function handleRetry() {
    setRetrying(true);
    try {
      const res = await fetch(`/api/events/${event.id}/retry`, { method: "POST" });
      if (res.ok) {
        const json = await res.json();
        onChanged(json.event);
      }
    } finally {
      setRetrying(false);
    }
  }

  const canRetry = event.status === "failed" || event.status === "partial";

  return (
    <div className="relative animate-node-in pl-7">
      <span className={clsx("absolute left-0 top-2 h-2.5 w-2.5 rounded-full", DOT_COLOR[event.status])} />
      {!isLast && <span className="absolute left-[4px] top-5 bottom-[-20px] w-px bg-border" />}

      <div className="rounded-card border border-border bg-panel p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 font-mono text-[11px] text-ink-faint">
              <span>{event.repository?.fullName ?? "unknown repo"}</span>
              <span>·</span>
              <span>
                {event.eventType}
                {event.payload.number ? ` #${event.payload.number}` : ""}
              </span>
              <span>·</span>
              <span>{relativeTime(event.createdAt)}</span>
            </div>
            <a
              href={event.payload.htmlUrl ?? event.repository?.htmlUrl ?? "#"}
              target="_blank"
              rel="noreferrer"
              className="truncate font-medium text-ink hover:underline"
            >
              {eventHeadline(event)}
            </a>
            {event.payload.author && (
              <p className="mt-0.5 text-xs text-ink-muted">by {event.payload.author}</p>
            )}
          </div>
          <StatusBadge status={event.status} />
        </div>

        {event.aiTriage && (
          <div className="mt-3 rounded-md border border-border bg-panel-raised px-3 py-2">
            <div className="flex items-center gap-2 text-[11px] font-mono">
              <span className="text-signal-info">AI triage</span>
              <span className={PRIORITY_COLOR[event.aiTriage.priority]}>
                {event.aiTriage.priority.toUpperCase()}
              </span>
              {event.aiTriage.suggestedLabels.length > 0 && (
                <span className="text-ink-faint">
                  suggests: {event.aiTriage.suggestedLabels.join(", ")}
                </span>
              )}
            </div>
            <p className="mt-1 text-[13px] text-ink-muted">{event.aiTriage.summary}</p>
          </div>
        )}

        {event.matchedRules && event.matchedRules.length > 0 && (
          <p className="mt-2 text-[11px] text-ink-faint">
            matched: {event.matchedRules.map((r) => r.name).join(", ")}
          </p>
        )}

        {event.actionLogs.length > 0 && (
          <div className="ml-1 mt-3 space-y-1.5 border-l border-dashed border-border pl-3">
            {event.actionLogs.map((action) => (
              <ActionRow key={action.id} action={action} />
            ))}
          </div>
        )}

        {event.lastError && event.status === "failed" && (
          <p className="mt-2 font-mono text-[11px] text-signal-fail/80">{event.lastError}</p>
        )}

        {canRetry && (
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="mt-3 rounded-md border border-border px-2.5 py-1 text-[11px] text-ink-muted transition hover:border-signal-info hover:text-signal-info disabled:opacity-50"
          >
            {retrying ? "Retrying…" : `Retry now (attempt ${event.retryCount + 1})`}
          </button>
        )}
      </div>
    </div>
  );
}
