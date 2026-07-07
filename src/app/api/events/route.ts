import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { EventStatus } from "@prisma/client";

const PAGE_SIZE = 30;

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const cursor = searchParams.get("cursor");
  const statusFilter = searchParams.get("status");
  const repositoryId = searchParams.get("repositoryId");

  const where: any = {
    repository: { installation: { userId: user.id } },
  };
  if (statusFilter && statusFilter in EventStatus) {
    where.status = statusFilter as EventStatus;
  }
  if (repositoryId) {
    where.repositoryId = repositoryId;
  }

  const events = await prisma.event.findMany({
    where,
    include: {
      repository: { select: { id: true, fullName: true, htmlUrl: true } },
      actionLogs: true,
    },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = events.length > PAGE_SIZE;
  const page = hasMore ? events.slice(0, PAGE_SIZE) : events;

  return NextResponse.json({
    events: page,
    nextCursor: hasMore ? page[page.length - 1]?.id : null,
  });
}
