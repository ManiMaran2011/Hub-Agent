import clsx from "clsx";
import type { DashboardActionLog } from "@/types/dashboard";

const ACTION_LABEL: Record<DashboardActionLog["type"], (detail: any) => string> = {
  add_label: (d) => `added label "${d?.label ?? "?"}"`,
  comment: () => "posted a comment",
  slack_notify: () => "sent Slack alert",
};

const STATUS_COLOR: Record<DashboardActionLog["status"], string> = {
  success: "text-signal-success",
  failed: "text-signal-fail",
  pending: "text-signal-retry",
};

const STATUS_ARROW: Record<DashboardActionLog["status"], string> = {
  success: "✓",
  failed: "✕",
  pending: "…",
};

export function ActionRow({ action }: { action: DashboardActionLog }) {
  return (
    <div className="flex flex-col gap-0.5 font-mono text-[12px]">
      <div className={clsx("flex items-center gap-2", STATUS_COLOR[action.status])}>
        <span>{STATUS_ARROW[action.status]}</span>
        <span>{ACTION_LABEL[action.type](action.detail)}</span>
      </div>
      {action.error && (
        <p className="ml-5 text-[11px] text-signal-fail/80">{action.error}</p>
      )}
    </div>
  );
}
