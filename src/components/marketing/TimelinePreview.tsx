const SAMPLE = [
  {
    title: "Login button crashes on Safari",
    meta: "meethu/reeliq · issue #142 · opened",
    dot: "bg-signal-success",
    actions: [
      { label: "added label bug", tone: "success" as const },
      { label: "sent Slack alert", tone: "success" as const },
    ],
  },
  {
    title: "Add streaming to /triage endpoint",
    meta: "meethu/reeliq · PR #58 · opened",
    dot: "bg-signal-info",
    actions: [
      { label: "AI triage: priority medium", tone: "info" as const },
      { label: "posted comment", tone: "success" as const },
    ],
  },
  {
    title: "push to main · 3 commits",
    meta: "meethu/reeliq · push",
    dot: "bg-ink-faint",
    actions: [{ label: "no rule matched", tone: "muted" as const }],
  },
];

const TONE_CLASS: Record<string, string> = {
  success: "text-signal-success",
  info: "text-signal-info",
  muted: "text-ink-faint",
};

export function TimelinePreview() {
  return (
    <div
      aria-hidden="true"
      className="rounded-card border border-border bg-panel/60 p-5 font-mono text-xs shadow-[0_0_0_1px_rgba(255,255,255,0.02)]"
    >
      <div className="mb-3 flex items-center gap-2 text-ink-faint">
        <span className="h-2 w-2 rounded-full bg-signal-fail" />
        <span className="h-2 w-2 rounded-full bg-signal-retry" />
        <span className="h-2 w-2 rounded-full bg-signal-success" />
        <span className="ml-2">live event feed</span>
      </div>
      <div className="space-y-5">
        {SAMPLE.map((event, i) => (
          <div key={event.title} className="relative pl-6">
            <span
              className={`absolute left-0 top-1.5 h-2 w-2 rounded-full ${event.dot}`}
            />
            {i < SAMPLE.length - 1 && (
              <span className="absolute left-[3px] top-4 h-[calc(100%+8px)] w-px bg-border" />
            )}
            <p className="font-body text-[13px] font-medium text-ink">{event.title}</p>
            <p className="mt-0.5 text-ink-faint">{event.meta}</p>
            <div className="ml-3 mt-2 space-y-1 border-l border-dashed border-border pl-3">
              {event.actions.map((a) => (
                <p key={a.label} className={TONE_CLASS[a.tone]}>
                  → {a.label}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
