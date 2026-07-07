import type { NormalizedEvent, RuleAction, RuleCondition } from "@/types/events";

export interface EvaluableRule {
  id: string;
  name: string;
  eventType: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
  priority: number;
}

export interface RuleMatch {
  ruleId: string;
  ruleName: string;
  actions: RuleAction[];
}

function fieldValue(event: NormalizedEvent, field: RuleCondition["field"]): string[] {
  switch (field) {
    case "title":
      return event.title ? [event.title] : [];
    case "body":
      return event.body ? [event.body] : [];
    case "author":
      return [event.author ?? event.sender.login];
    case "label":
      return event.existingLabels ?? [];
    case "branch":
      return event.branch ? [event.branch] : [];
    default:
      return [];
  }
}

function matchesCondition(event: NormalizedEvent, condition: RuleCondition): boolean {
  const values = fieldValue(event, condition.field);
  if (values.length === 0) return false;

  const cs = condition.caseSensitive ?? false;
  const target = cs ? condition.value : condition.value.toLowerCase();

  return values.some((raw) => {
    const v = cs ? raw : raw.toLowerCase();
    switch (condition.op) {
      case "contains":
        return v.includes(target);
      case "equals":
        return v === target;
      case "startsWith":
        return v.startsWith(target);
      default:
        return false;
    }
  });
}

/**
 * A rule matches when its eventType matches (or is "any") AND every one of
 * its conditions matches (AND semantics — kept intentionally simple for
 * v1; see README's "what I'd add with more time" for OR-group support).
 * Rules with zero conditions match any event of the right type — useful
 * for "always notify Slack on new PRs" style rules.
 */
export function evaluateRules(event: NormalizedEvent, rules: EvaluableRule[]): RuleMatch[] {
  const applicable = rules
    .filter((r) => r.eventType === "any" || r.eventType === event.eventType)
    .sort((a, b) => a.priority - b.priority);

  const matches: RuleMatch[] = [];
  for (const rule of applicable) {
    const allMatch = rule.conditions.every((c) => matchesCondition(event, c));
    if (allMatch) {
      matches.push({ ruleId: rule.id, ruleName: rule.name, actions: rule.actions });
    }
  }
  return matches;
}

/** Flattens matched rules into a de-duplicated action list, preserving order. */
export function collectActions(matches: RuleMatch[]): RuleAction[] {
  const seen = new Set<string>();
  const actions: RuleAction[] = [];
  for (const match of matches) {
    for (const action of match.actions) {
      const key = JSON.stringify(action);
      if (seen.has(key)) continue;
      seen.add(key);
      actions.push(action);
    }
  }
  return actions;
}
