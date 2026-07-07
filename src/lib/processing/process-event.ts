import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { runAiTriage } from "@/lib/ai";
import { collectActions, evaluateRules, type EvaluableRule } from "@/lib/rules-engine";
import { addLabel, postComment } from "@/lib/github/actions";
import { sendSlackNotification } from "@/lib/slack";
import { renderTemplate } from "@/lib/template";
import { nextRetryDelayMinutes, MAX_ATTEMPTS } from "@/lib/processing/backoff";
import type { AiTriageResult, NormalizedEvent, RuleAction } from "@/types/events";
import { ActionStatus, ActionType, EventStatus, type ActionLog, type Rule } from "@prisma/client";

function actionToDbType(action: RuleAction): ActionType {
  switch (action.type) {
    case "add_label":
      return ActionType.add_label;
    case "comment":
      return ActionType.comment;
    case "slack_notify":
      return ActionType.slack_notify;
  }
}

function actionSignature(action: RuleAction): string {
  return JSON.stringify(action);
}

/**
 * Executes one action and returns whether it succeeded. Never throws —
 * failures are captured and returned so the caller can record them and
 * keep going with the remaining actions (one Slack failure shouldn't
 * prevent a GitHub label from being applied, or vice versa).
 */
async function runAction(
  action: RuleAction,
  event: NormalizedEvent,
  ai: AiTriageResult | null,
  matchedRuleNames: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (action.type === "add_label") {
      await addLabel(event, action.label);
      return { ok: true };
    }
    if (action.type === "comment") {
      const body = renderTemplate(action.template, event, ai);
      await postComment(event, body);
      return { ok: true };
    }
    if (action.type === "slack_notify") {
      const text = renderTemplate(action.template, event, ai);
      const result = await sendSlackNotification({ text, event, ai, matchedRuleNames });
      return result.ok ? { ok: true } : { ok: false, error: result.error ?? "slack_failed" };
    }
    return { ok: false, error: "unknown_action_type" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Processes a single persisted Event end-to-end. Safe to call more than
 * once for the same event (e.g. cron retry after a partial failure):
 * actions that already have a `success` ActionLog are skipped, so re-runs
 * only retry the piece that actually failed.
 */
export async function processEvent(eventId: string): Promise<void> {
  const dbEvent = await prisma.event.findUnique({
    where: { id: eventId },
    include: { repository: { include: { installation: true } }, actionLogs: true },
  });

  if (!dbEvent) {
    logger.error("process_event_not_found", { eventId });
    return;
  }

  if (dbEvent.status === EventStatus.success || dbEvent.status === EventStatus.ignored) {
    return; // nothing to do — guards against a race between cron and inline processing
  }

  await prisma.event.update({
    where: { id: dbEvent.id },
    data: { status: EventStatus.processing },
  });

  const event = dbEvent.payload as unknown as NormalizedEvent;

  try {
    if (!dbEvent.repositoryId || !dbEvent.repository) {
      throw new Error("event has no linked repository (was it deleted?)");
    }

    const rules = await prisma.rule.findMany({
      where: {
        enabled: true,
        userId: dbEvent.repository.installation.userId,
        OR: [{ repositoryId: dbEvent.repositoryId }, { repositoryId: null }],
      },
    });

    const evaluable: EvaluableRule[] = rules.map((r: Rule) => ({
      id: r.id,
      name: r.name,
      eventType: r.eventType,
      conditions: r.conditions as any,
      actions: r.actions as any,
      priority: r.priority,
    }));

    const matches = evaluateRules(event, evaluable);
    const matchedRuleNames = matches.map((m) => m.ruleName);

    await prisma.event.update({
      where: { id: dbEvent.id },
      data: {
        matchedRules: matches.map((m) => ({ id: m.ruleId, name: m.ruleName })),
      },
    });

    if (matches.length === 0) {
      await prisma.event.update({
        where: { id: dbEvent.id },
        data: { status: EventStatus.ignored, processedAt: new Date() },
      });
      return;
    }

    // AI triage runs once per event and is cached on the row — a retry
    // reuses the prior result instead of spending another API call and
    // (more importantly) potentially getting a different priority/label
    // suggestion on each attempt.
    let ai = dbEvent.aiTriage as unknown as AiTriageResult | null;
    if (!ai) {
      ai = await runAiTriage(event);
      if (ai) {
        await prisma.event.update({ where: { id: dbEvent.id }, data: { aiTriage: ai as any } });
      }
    }

    const actions = collectActions(matches);
    const existingLogs = dbEvent.actionLogs;

    let anyFailed = false;
    let anySucceeded = false;
    let lastError: string | null = null;

    for (const action of actions) {
      const type = actionToDbType(action);
      const signature = actionSignature(action);

      let log = existingLogs.find(
        (l: ActionLog) => l.type === type && JSON.stringify(l.detail) === JSON.stringify(action)
      );

      if (log?.status === ActionStatus.success) {
        anySucceeded = true;
        continue; // already done on a prior attempt
      }

      if (!log) {
        log = await prisma.actionLog.create({
          data: {
            eventId: dbEvent.id,
            type,
            status: ActionStatus.pending,
            detail: action as any,
            attempts: 0,
          },
        });
      }

      const result = await runAction(action, event, ai, matchedRuleNames);

      await prisma.actionLog.update({
        where: { id: log.id },
        data: {
          status: result.ok ? ActionStatus.success : ActionStatus.failed,
          error: result.ok ? null : result.error,
          attempts: { increment: 1 },
        },
      });

      if (result.ok) {
        anySucceeded = true;
      } else {
        anyFailed = true;
        lastError = result.error;
        logger.warn("action_failed", {
          deliveryId: event.deliveryId,
          actionType: action.type,
          error: result.error,
          signature,
        });
      }
    }

    const finalStatus = anyFailed
      ? anySucceeded
        ? EventStatus.partial
        : EventStatus.failed
      : EventStatus.success;

    const retryCount = dbEvent.retryCount + (anyFailed ? 1 : 0);
    const delay = anyFailed ? nextRetryDelayMinutes(retryCount) : null;
    const exhausted = anyFailed && retryCount >= MAX_ATTEMPTS;

    await prisma.event.update({
      where: { id: dbEvent.id },
      data: {
        status: finalStatus,
        retryCount,
        lastError: anyFailed ? lastError : null,
        nextRetryAt: anyFailed && !exhausted && delay ? new Date(Date.now() + delay * 60_000) : null,
        processedAt: finalStatus === EventStatus.success ? new Date() : dbEvent.processedAt,
      },
    });

    logger.info("event_processed", {
      deliveryId: event.deliveryId,
      status: finalStatus,
      matchedRules: matchedRuleNames,
      retryCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("process_event_exception", { eventId, error: message });

    const retryCount = dbEvent.retryCount + 1;
    const delay = nextRetryDelayMinutes(retryCount);
    const exhausted = retryCount >= MAX_ATTEMPTS;

    await prisma.event.update({
      where: { id: dbEvent.id },
      data: {
        status: EventStatus.failed,
        retryCount,
        lastError: message,
        nextRetryAt: !exhausted && delay ? new Date(Date.now() + delay * 60_000) : null,
      },
    });
  }
}
