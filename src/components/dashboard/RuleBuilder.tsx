"use client";

import { useState } from "react";
import type { RuleAction, RuleCondition } from "@/types/events";
import { ActionRowEditor, ConditionRow } from "@/components/dashboard/RuleFieldEditors";

export interface RuleFormValue {
  id?: string;
  name: string;
  eventType: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
  enabled: boolean;
  priority: number;
  repositoryId: string | null;
}

const EMPTY_RULE: RuleFormValue = {
  name: "",
  eventType: "issues",
  conditions: [],
  actions: [{ type: "slack_notify", template: "New {{title}} ({{url}})" }],
  enabled: true,
  priority: 100,
  repositoryId: null,
};

export function RuleBuilder({
  repos,
  initial,
  onSaved,
  onCancel,
}: {
  repos: { id: string; fullName: string }[];
  initial?: RuleFormValue;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [rule, setRule] = useState<RuleFormValue>(initial ?? EMPTY_RULE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateCondition(i: number, c: RuleCondition) {
    setRule((r) => ({ ...r, conditions: r.conditions.map((old, idx) => (idx === i ? c : old)) }));
  }
  function removeCondition(i: number) {
    setRule((r) => ({ ...r, conditions: r.conditions.filter((_, idx) => idx !== i) }));
  }
  function addCondition() {
    setRule((r) => ({
      ...r,
      conditions: [...r.conditions, { field: "title", op: "contains", value: "" }],
    }));
  }

  function updateAction(i: number, a: RuleAction) {
    setRule((r) => ({ ...r, actions: r.actions.map((old, idx) => (idx === i ? a : old)) }));
  }
  function removeAction(i: number) {
    setRule((r) => ({ ...r, actions: r.actions.filter((_, idx) => idx !== i) }));
  }
  function addAction() {
    setRule((r) => ({ ...r, actions: [...r.actions, { type: "add_label", label: "" }] }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!rule.name.trim()) return setError("Give this rule a name.");
    if (rule.actions.length === 0) return setError("Add at least one action.");

    setSaving(true);
    try {
      const res = await fetch(rule.id ? `/api/rules/${rule.id}` : "/api/rules", {
        method: rule.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rule),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "Could not save the rule.");
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 space-y-5 rounded-card border border-border bg-panel p-5"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base font-semibold text-ink">
          {rule.id ? "Edit rule" : "New rule"}
        </h2>
        <button type="button" onClick={onCancel} className="text-sm text-ink-faint hover:text-ink">
          Cancel
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs text-ink-muted">Name</span>
          <input
            value={rule.name}
            onChange={(e) => setRule({ ...rule, name: e.target.value })}
            placeholder="Label and alert on bug reports"
            className="w-full rounded-md border border-border bg-panel-raised px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-faint"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-ink-muted">Applies to</span>
          <select
            value={rule.eventType}
            onChange={(e) => setRule({ ...rule, eventType: e.target.value })}
            className="w-full rounded-md border border-border bg-panel-raised px-2.5 py-1.5 text-sm text-ink"
          >
            <option value="issues">Issues</option>
            <option value="pull_request">Pull requests</option>
            <option value="push">Pushes</option>
            <option value="any">Any event</option>
          </select>
        </label>

        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs text-ink-muted">Repository</span>
          <select
            value={rule.repositoryId ?? ""}
            onChange={(e) => setRule({ ...rule, repositoryId: e.target.value || null })}
            className="w-full rounded-md border border-border bg-panel-raised px-2.5 py-1.5 text-sm text-ink"
          >
            <option value="">All connected repositories</option>
            {repos.map((r) => (
              <option key={r.id} value={r.id}>
                {r.fullName}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs text-ink-muted">
            Conditions (all must match — leave empty to match every event)
          </span>
          <button
            type="button"
            onClick={addCondition}
            className="text-xs text-signal-info hover:underline"
          >
            + Add condition
          </button>
        </div>
        <div className="space-y-2">
          {rule.conditions.map((c, i) => (
            <ConditionRow
              key={i}
              condition={c}
              onChange={(nc) => updateCondition(i, nc)}
              onRemove={() => removeCondition(i)}
            />
          ))}
          {rule.conditions.length === 0 && (
            <p className="text-xs text-ink-faint">No conditions — this rule fires on every matching event.</p>
          )}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs text-ink-muted">Actions</span>
          <button type="button" onClick={addAction} className="text-xs text-signal-info hover:underline">
            + Add action
          </button>
        </div>
        <div className="space-y-2">
          {rule.actions.map((a, i) => (
            <ActionRowEditor
              key={i}
              action={a}
              onChange={(na) => updateAction(i, na)}
              onRemove={() => removeAction(i)}
            />
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-signal-fail">{error}</p>}

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          <input
            type="checkbox"
            checked={rule.enabled}
            onChange={(e) => setRule({ ...rule, enabled: e.target.checked })}
            className="accent-signal-info"
          />
          Enabled
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-signal-info px-4 py-2 text-sm font-medium text-canvas disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save rule"}
        </button>
      </div>
    </form>
  );
}
