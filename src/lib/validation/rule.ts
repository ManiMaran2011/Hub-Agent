import { z } from "zod";

const conditionSchema = z.object({
  field: z.enum(["title", "body", "author", "label", "branch"]),
  op: z.enum(["contains", "equals", "startsWith"]),
  value: z.string().min(1).max(200),
  caseSensitive: z.boolean().optional(),
});

const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("add_label"), label: z.string().min(1).max(50) }),
  z.object({ type: z.literal("comment"), template: z.string().min(1).max(2000) }),
  z.object({ type: z.literal("slack_notify"), template: z.string().min(1).max(2000) }),
]);

export const ruleInputSchema = z.object({
  name: z.string().min(1).max(80),
  eventType: z.enum(["issues", "pull_request", "push", "any"]),
  conditions: z.array(conditionSchema).max(10),
  actions: z.array(actionSchema).min(1).max(5),
  enabled: z.boolean().default(true),
  priority: z.number().int().min(0).max(1000).default(100),
  repositoryId: z.string().nullable().optional(),
});

export type RuleInput = z.infer<typeof ruleInputSchema>;
