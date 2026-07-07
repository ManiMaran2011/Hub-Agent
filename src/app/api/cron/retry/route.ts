import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { prisma } from "@/lib/db";
import { processEvent } from "@/lib/processing/process-event";
import { logger } from "@/lib/logger";
import { EventStatus } from "@prisma/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH_SIZE = 25;
const STUCK_PROCESSING_MINUTES = 10;

/**
 * This is the durability backstop described in the assessment's quality
 * bar ("should not silently lose events if a downstream call or your own
 * service is briefly unavailable"). Three cases it sweeps up:
 *  1. `failed` events whose `nextRetryAt` has arrived (normal backoff).
 *  2. `pending` events that somehow never got processed inline — e.g. the
 *     serverless function was recycled before `waitUntil` finished.
 *  3. `processing` events stuck for >10 minutes — almost certainly a crash
 *     mid-run rather than genuinely still working, so we reset and retry.
 */
export async function GET(request: NextRequest) {
  const env = getEnv();
  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const stuckThreshold = new Date(now.getTime() - STUCK_PROCESSING_MINUTES * 60_000);

  await prisma.event.updateMany({
    where: { status: EventStatus.processing, updatedAt: { lt: stuckThreshold } },
    data: { status: EventStatus.failed, nextRetryAt: now },
  });

  const dueEvents = await prisma.event.findMany({
    where: {
      OR: [
        { status: EventStatus.failed, nextRetryAt: { lte: now } },
        { status: EventStatus.pending, createdAt: { lt: new Date(now.getTime() - 2 * 60_000) } },
      ],
    },
    take: BATCH_SIZE,
    orderBy: { updatedAt: "asc" },
  });

  logger.info("retry_sweep_started", { candidateCount: dueEvents.length });

  let succeeded = 0;
  let stillFailing = 0;

  for (const event of dueEvents) {
    await processEvent(event.id);
    const refreshed = await prisma.event.findUnique({ where: { id: event.id } });
    if (refreshed?.status === EventStatus.success || refreshed?.status === EventStatus.ignored) {
      succeeded++;
    } else {
      stillFailing++;
    }
  }

  logger.info("retry_sweep_finished", { processed: dueEvents.length, succeeded, stillFailing });

  return NextResponse.json({ processed: dueEvents.length, succeeded, stillFailing });
}
