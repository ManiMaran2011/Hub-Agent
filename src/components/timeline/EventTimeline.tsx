"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { EventNode } from "@/components/timeline/EventNode";
import type { DashboardEvent } from "@/types/dashboard";

const FILTERS = [
  { value: "", label: "All" },
  { value: "success", label: "Success" },
  { value: "partial", label: "Partial" },
  { value: "failed", label: "Failed" },
  { value: "ignored", label: "No match" },
] as const;

const POLL_INTERVAL_MS = 6000;

export function EventTimeline() {
  const [events, setEvents] = useState<DashboardEvent[] | null>(null);
  const [filter, setFilter] = useState<string>("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const filterRef = useRef(filter);
  filterRef.current = filter;

  const fetchLatest = useCallback(async (statusFilter: string) => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/events?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) return;
    const json = await res.json();
    setEvents(json.events);
    setNextCursor(json.nextCursor);
  }, []);

  useEffect(() => {
    fetchLatest(filter);
    const interval = setInterval(() => fetchLatest(filterRef.current), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [filter, fetchLatest]);

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    const params = new URLSearchParams();
    if (filter) params.set("status", filter);
    params.set("cursor", nextCursor);
    const res = await fetch(`/api/events?${params.toString()}`);
    const json = await res.json();
    setEvents((prev) => [...(prev ?? []), ...json.events]);
    setNextCursor(json.nextCursor);
    setLoadingMore(false);
  }

  function handleEventChanged(updated: DashboardEvent) {
    setEvents((prev) => prev?.map((e) => (e.id === updated.id ? updated : e)) ?? prev);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Activity</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Every webhook GHOps Bot received and what it did about it.
          </p>
        </div>
        <div className="flex gap-1 rounded-md border border-border bg-panel p-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={clsx(
                "rounded px-2.5 py-1 text-xs transition",
                filter === f.value ? "bg-panel-raised text-ink" : "text-ink-faint hover:text-ink-muted"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {events === null && <TimelineSkeleton />}

      {events !== null && events.length === 0 && <EmptyTimeline />}

      {events !== null && events.length > 0 && (
        <div className="space-y-5">
          {events.map((event, i) => (
            <EventNode
              key={event.id}
              event={event}
              isLast={i === events.length - 1 && !nextCursor}
              onChanged={handleEventChanged}
            />
          ))}
        </div>
      )}

      {nextCursor && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="mt-6 w-full rounded-md border border-border py-2 text-xs text-ink-muted hover:text-ink disabled:opacity-50"
        >
          {loadingMore ? "Loading…" : "Load older events"}
        </button>
      )}
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <div className="space-y-5">
      {[0, 1, 2].map((i) => (
        <div key={i} className="ml-7 h-24 animate-pulse rounded-card border border-border bg-panel" />
      ))}
    </div>
  );
}

function EmptyTimeline() {
  return (
    <div className="rounded-card border border-dashed border-border bg-panel/40 p-10 text-center">
      <p className="font-display text-base font-medium text-ink">Nothing here yet</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
        Connect a repository and open an issue or pull request on it — this
        feed fills in the moment GitHub sends the first webhook.
      </p>
      <a
        href="/dashboard/repos"
        className="mt-4 inline-block rounded-md bg-signal-info/15 px-3 py-1.5 text-sm text-signal-info hover:bg-signal-info/25"
      >
        Connect a repository
      </a>
    </div>
  );
}
