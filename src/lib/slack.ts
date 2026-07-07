import { getEnv, isSlackConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { AiTriageResult, NormalizedEvent } from "@/types/events";

const SLACK_API = "https://slack.com/api/chat.postMessage";

const PRIORITY_COLOR: Record<AiTriageResult["priority"], string> = {
  high: "#F0555A",
  medium: "#F5A623",
  low: "#3DD68C",
};

export interface SlackSendResult {
  ok: boolean;
  error?: string;
  ts?: string;
}

/**
 * Posts a single Slack message via chat.postMessage (Bot token), using
 * Block Kit for a readable card instead of a flat text blob. Color accent
 * comes from AI-assessed priority when available, otherwise a neutral
 * info color — this is what gives the "wow" of a genuinely useful
 * notification instead of "Event received: issues.opened".
 *
 * Returns a structured result rather than throwing on Slack-side failure,
 * so the caller (action executor) can record it as a failed ActionLog and
 * let the retry sweep pick it up, instead of the whole event blowing up.
 */
export async function sendSlackNotification(params: {
  text: string;
  event: NormalizedEvent;
  ai: AiTriageResult | null;
  matchedRuleNames: string[];
}): Promise<SlackSendResult> {
  if (!isSlackConfigured()) {
    logger.warn("slack_not_configured_skipping_notification", {
      deliveryId: params.event.deliveryId,
    });
    return { ok: false, error: "Slack is not configured" };
  }

  const env = getEnv();
  const { event, ai, matchedRuleNames } = params;
  const color = ai ? PRIORITY_COLOR[ai.priority] : "#6C7BFF";

  const contextLine = [
    `*${event.repo.fullName}*`,
    event.number ? `#${event.number}` : null,
    `by ${event.author ?? event.sender.login}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const blocks: Record<string, unknown>[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${event.title ?? event.eventType}*\n${contextLine}`,
      },
    },
  ];

  if (ai) {
    blocks.push({
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Priority*\n${ai.priority.toUpperCase()}` },
        {
          type: "mrkdwn",
          text: `*Suggested labels*\n${ai.suggestedLabels.join(", ") || "—"}`,
        },
      ],
    });
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `_${ai.summary}_` },
    });
  }

  if (matchedRuleNames.length > 0) {
    blocks.push({
      type: "context",
      elements: [
        { type: "mrkdwn", text: `Matched rules: ${matchedRuleNames.join(", ")}` },
      ],
    });
  }

  if (event.htmlUrl) {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "View on GitHub" },
          url: event.htmlUrl,
        },
      ],
    });
  }

  try {
    const res = await fetch(SLACK_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        channel: env.SLACK_CHANNEL_ID,
        text: params.text, // fallback for notifications/screen readers
        attachments: [{ color, blocks }],
      }),
    });

    const json = (await res.json()) as { ok: boolean; error?: string; ts?: string };
    if (!json.ok) {
      logger.error("slack_post_failed", { error: json.error, deliveryId: event.deliveryId });
      return { ok: false, error: json.error ?? "unknown_slack_error" };
    }
    return { ok: true, ts: json.ts };
  } catch (err) {
    logger.error("slack_post_exception", {
      error: err instanceof Error ? err.message : String(err),
      deliveryId: event.deliveryId,
    });
    return { ok: false, error: err instanceof Error ? err.message : "unknown_error" };
  }
}
