import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/db";
import { verifyGithubSignature } from "@/lib/github/webhook-verify";
import { isSupportedEventType, normalizeGithubEvent } from "@/lib/github/normalize";
import {
  handleInstallationRepositoriesWebhookEvent,
  handleInstallationWebhookEvent,
} from "@/lib/github/installations";
import { processEvent } from "@/lib/processing/process-event";
import { EventStatus } from "@prisma/client";

// This route must read the raw, unparsed body to verify GitHub's HMAC
// signature (see lib/github/webhook-verify.ts for why). Route Handlers in
// the App Router give us the raw stream via request.text()/request.json()
// on demand, so no special config is required here — just discipline to
// call request.text() exactly once and verify before parsing.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const env = getEnv();
  const rawBody = await request.text();

  const signature = request.headers.get("x-hub-signature-256");
  const isValid = verifyGithubSignature(rawBody, signature, env.GITHUB_APP_WEBHOOK_SECRET);

  if (!isValid) {
    logger.warn("webhook_signature_invalid", {
      hasSignatureHeader: Boolean(signature),
    });
    // 401, not 200 — an invalid signature must never look like success to
    // whoever (or whatever) sent it, and must never touch the DB.
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const eventType = request.headers.get("x-github-event");
  const deliveryId = request.headers.get("x-github-delivery");

  if (!eventType || !deliveryId) {
    return NextResponse.json({ error: "missing required GitHub headers" }, { status: 400 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  logger.info("webhook_received", { eventType, deliveryId, action: payload.action });

  if (eventType === "ping") {
    return NextResponse.json({ ok: true, message: "pong" });
  }

  if (eventType === "installation") {
    await handleInstallationWebhookEvent(payload.action, payload);
    return NextResponse.json({ ok: true });
  }

  if (eventType === "installation_repositories") {
    await handleInstallationRepositoriesWebhookEvent(payload);
    return NextResponse.json({ ok: true });
  }

  if (!isSupportedEventType(eventType)) {
    // Acknowledge and drop — we only act on issues/pull_request/push, and
    // we didn't subscribe to anything else, but a defensive check here
    // means an App config change elsewhere can't cause 4xx/5xx noise.
    return NextResponse.json({ ok: true, message: "event type not handled" });
  }

  const installationId: number | undefined = payload.installation?.id;
  if (!installationId) {
    return NextResponse.json({ error: "payload missing installation id" }, { status: 400 });
  }

  const normalized = normalizeGithubEvent(eventType, deliveryId, installationId, payload);

  const repository = await prisma.repository.findUnique({
    where: { githubRepoId: payload.repository?.id },
  });

  // Idempotency: `deliveryId` is unique on Event. If GitHub redelivers
  // (timeout, 5xx, manual redelivery from their UI), this upsert is a
  // no-op on the `update` branch instead of creating a duplicate row or
  // re-running actions. We deliberately do NOT re-trigger processing on
  // an already-existing delivery.
  let event;
  try {
    event = await prisma.event.create({
      data: {
        deliveryId,
        eventType,
        action: payload.action ?? null,
        status: normalized ? EventStatus.pending : EventStatus.ignored,
        payload: (normalized ?? { eventType, action: payload.action, note: "unactionable action" }) as any,
        repositoryId: repository?.id ?? null,
        lastError: repository ? null : "repository not connected in GHOps Bot yet",
      },
    });
  } catch (err: any) {
    if (err?.code === "P2002") {
      // Unique constraint on deliveryId -> this is a redelivery of an
      // event we've already recorded. Ack it without reprocessing.
      logger.info("webhook_duplicate_delivery_ignored", { deliveryId });
      return NextResponse.json({ ok: true, message: "duplicate delivery, already recorded" });
    }
    logger.error("webhook_persist_failed", {
      deliveryId,
      error: err instanceof Error ? err.message : String(err),
    });
    // Return 500 so GitHub retries — we could not durably persist the
    // event, so losing it here would violate "never silently lose events".
    return NextResponse.json({ error: "failed to persist event" }, { status: 500 });
  }

  if (normalized && repository) {
    // Process after responding: keeps the webhook ack fast (GitHub times
    // out slow endpoints and treats them as failed) while still running
    // to completion in the background on this same invocation.
    waitUntil(
      processEvent(event.id).catch((err) => {
        logger.error("process_event_uncaught", {
          eventId: event.id,
          error: err instanceof Error ? err.message : String(err),
        });
      })
    );
  }

  return NextResponse.json({ ok: true, eventId: event.id });
}
