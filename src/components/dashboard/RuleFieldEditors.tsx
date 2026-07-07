"use client";

import type { RuleAction, RuleCondition } from "@/types/events";
import { AVAILABLE_TEMPLATE_VARS } from "@/lib/template";

const FIELD_OPTIONS: RuleCondition["field"][] = ["title", "body", "author", "label", "branch"];
const OP_OPTIONS: RuleCondition["op"][] = ["contains", "equals", "startsWith"];

export function ConditionRow({
  condition,
  onChange,
  onRemove,
}: {
  condition: RuleCondition;
  onChange: (c: RuleCondition) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <select
        value={condition.field}
        onChange={(e) => onChange({ ...condition, field: e.target.value as RuleCondition["field"] })}
        className="rounded-md border border-border bg-panel-raised px-2 py-1.5 text-sm text-ink"
      >
        {FIELD_OPTIONS.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>
      <select
        value={condition.op}
        onChange={(e) => onChange({ ...condition, op: e.target.value as RuleCondition["op"] })}
        className="rounded-md border border-border bg-panel-raised px-2 py-1.5 text-sm text-ink"
      >
        {OP_OPTIONS.map((op) => (
          <option key={op} value={op}>
            {op}
          </option>
        ))}
      </select>
      <input
        value={condition.value}
        onChange={(e) => onChange({ ...condition, value: e.target.value })}
        placeholder="value"
        className="flex-1 rounded-md border border-border bg-panel-raised px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-faint"
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove condition"
        className="rounded-md px-2 text-ink-faint hover:text-signal-fail"
      >
        ✕
      </button>
    </div>
  );
}

const ACTION_TYPES: RuleAction["type"][] = ["add_label", "comment", "slack_notify"];

export function ActionRowEditor({
  action,
  onChange,
  onRemove,
}: {
  action: RuleAction;
  onChange: (a: RuleAction) => void;
  onRemove: () => void;
}) {
  function handleTypeChange(type: RuleAction["type"]) {
    if (type === "add_label") onChange({ type, label: "" });
    if (type === "comment") onChange({ type, template: "" });
    if (type === "slack_notify") onChange({ type, template: "" });
  }

  return (
    <div className="rounded-md border border-border bg-panel-raised p-3">
      <div className="flex items-center justify-between">
        <select
          value={action.type}
          onChange={(e) => handleTypeChange(e.target.value as RuleAction["type"])}
          className="rounded-md border border-border bg-panel px-2 py-1 text-sm text-ink"
        >
          {ACTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {t === "add_label" ? "Add label" : t === "comment" ? "Post comment" : "Send Slack alert"}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove action"
          className="text-ink-faint hover:text-signal-fail"
        >
          ✕
        </button>
      </div>

      {action.type === "add_label" && (
        <input
          value={action.label}
          onChange={(e) => onChange({ type: "add_label", label: e.target.value })}
          placeholder="bug"
          className="mt-2 w-full rounded-md border border-border bg-panel px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-faint"
        />
      )}

      {(action.type === "comment" || action.type === "slack_notify") && (
        <>
          <textarea
            value={action.template}
            onChange={(e) =>
              onChange(
                action.type === "comment"
                  ? { type: "comment", template: e.target.value }
                  : { type: "slack_notify", template: e.target.value }
              )
            }
            placeholder={
              action.type === "comment"
                ? "Thanks for the report, {{author}} — triaging now."
                : "New {{ai_priority}} priority issue: {{title}} ({{url}})"
            }
            rows={2}
            className="mt-2 w-full resize-none rounded-md border border-border bg-panel px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-faint"
          />
          <p className="mt-1 font-mono text-[10px] text-ink-faint">
            variables: {AVAILABLE_TEMPLATE_VARS.map((v) => `{{${v}}}`).join(" ")}
          </p>
        </>
      )}
    </div>
  );
}
