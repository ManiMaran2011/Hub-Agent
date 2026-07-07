import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { processEvent } from "@/lib/processing/process-event";
import { logger } from "@/lib/logger";

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const event = await prisma.event.findFirst({
    where: { id: params.id, repository: { installation: { userId: user.id } } },
  });
  if (!event) return NextResponse.json({ error: "not found" }, { status: 404 });

  logger.info("manual_retry_triggered", { userId: user.id, eventId: event.id });
  await processEvent(event.id);

  const refreshed = await prisma.event.findUnique({
    where: { id: event.id },
    include: { actionLogs: true },
  });

  return NextResponse.json({ event: refreshed });
}
