import clsx from "clsx";

const STATUS_STYLES: Record<string, { label: string; className: string; pulse?: boolean }> = {
  pending: { label: "Pending", className: "bg-signal-info-dim text-signal-info", pulse: true },
  processing: { label: "Processing", className: "bg-signal-info-dim text-signal-info", pulse: true },
  success: { label: "Success", className: "bg-signal-success-dim text-signal-success" },
  partial: { label: "Partial", className: "bg-signal-retry-dim text-signal-retry" },
  failed: { label: "Failed", className: "bg-signal-fail-dim text-signal-fail" },
  ignored: { label: "No rule matched", className: "bg-panel-raised text-ink-faint" },
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? {
    label: status,
    className: "bg-panel-raised text-ink-muted",
  };

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[11px] font-medium",
        style.className
      )}
    >
      <span className={clsx("h-1.5 w-1.5 rounded-full bg-current", style.pulse && "animate-pulse-dot")} />
      {style.label}
    </span>
  );
}
