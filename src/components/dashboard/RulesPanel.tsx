"use client";

import { useCallback, useEffect, useState } from "react";
import { RuleBuilder, type RuleFormValue } from "@/components/dashboard/RuleBuilder";

interface RuleRow extends RuleFormValue {
  id: string;
  repository: { id: string; fullName: string } | null;
}

export function RulesPanel() {
  const [rules, setRules] = useState<RuleRow[] | null>(null);
  const [repos, setRepos] = useState<{ id: string; fullName: string }[]>([]);
  const [editing, setEditing] = useState<RuleFormValue | "new" | null>(null);

  const loadRules = useCallback(() => {
    fetch("/api/rules")
      .then((r) => r.json())
      .then((json) => setRules(json.rules));
  }, []);

  useEffect(() => {
    loadRules();
    fetch("/api/repos")
      .then((r) => r.json())
      .then((json) => {
        const flat = (json.installations ?? []).flatMap((i: any) => i.repositories);
        setRepos(flat.map((r: any) => ({ id: r.id, fullName: r.fullName })));
      });
  }, [loadRules]);

  async function toggleEnabled(rule: RuleRow) {
    await fetch(`/api/rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !rule.enabled }),
    });
    loadRules();
  }

  async function deleteRule(id: string) {
    if (!confirm("Delete this rule? This can't be undone.")) return;
    await fetch(`/api/rules/${id}`, { method: "DELETE" });
    loadRules();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Rules</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Match on title, author, label, or branch — decide what the bot does.
          </p>
        </div>
        {editing === null && (
          <button
            onClick={() => setEditing("new")}
            className="rounded-md bg-signal-info px-4 py-2 text-sm font-medium text-canvas hover:opacity-90"
          >
            New rule
          </button>
        )}
      </div>

      {editing !== null && (
        <RuleBuilder
          repos={repos}
          initial={editing === "new" ? undefined : editing}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            loadRules();
          }}
        />
      )}

      {rules === null && (
        <div className="h-32 animate-pulse rounded-card border border-border bg-panel" />
      )}

      {rules !== null && rules.length === 0 && editing === null && (
        <div className="rounded-card border border-dashed border-border bg-panel/40 p-10 text-center">
          <p className="font-display text-base font-medium text-ink">No rules yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
            Without a rule, GHOps Bot logs every event but takes no action.
            Try: issues whose title contains &ldquo;bug&rdquo; → add label &ldquo;bug&rdquo; + Slack alert.
          </p>
        </div>
      )}

      {rules !== null && rules.length > 0 && (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div key={rule.id} className="rounded-card border border-border bg-panel p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-ink">{rule.name}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-ink-faint">
                    {rule.eventType} · {rule.repository?.fullName ?? "all repos"} ·{" "}
                    {rule.conditions.length} condition{rule.conditions.length === 1 ? "" : "s"} ·{" "}
                    {rule.actions.length} action{rule.actions.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleEnabled(rule)}
                    className={`rounded-full px-2 py-0.5 text-[11px] ${
                      rule.enabled
                        ? "bg-signal-success-dim text-signal-success"
                        : "bg-panel-raised text-ink-faint"
                    }`}
                  >
                    {rule.enabled ? "Enabled" : "Disabled"}
                  </button>
                  <button
                    onClick={() => setEditing(rule)}
                    className="text-xs text-ink-muted hover:text-ink"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteRule(rule.id)}
                    className="text-xs text-ink-faint hover:text-signal-fail"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
