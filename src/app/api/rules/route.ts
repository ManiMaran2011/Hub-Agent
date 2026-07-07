import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { ruleInputSchema } from "@/lib/validation/rule";
import { logger } from "@/lib/logger";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rules = await prisma.rule.findMany({
    where: { userId: user.id },
    include: { repository: { select: { id: true, fullName: true } } },
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ rules });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = ruleInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid rule", details: parsed.error.flatten() }, { status: 400 });
  }

  // If a repository is specified, confirm it actually belongs to this
  // user's installations — otherwise a crafted request could scope a rule
  // to (and later act on) a repo the user never connected.
  if (parsed.data.repositoryId) {
    const repo = await prisma.repository.findFirst({
      where: { id: parsed.data.repositoryId, installation: { userId: user.id } },
    });
    if (!repo) {
      return NextResponse.json({ error: "repository not found or not connected by you" }, { status: 403 });
    }
  }

  const rule = await prisma.rule.create({
    data: {
      userId: user.id,
      name: parsed.data.name,
      eventType: parsed.data.eventType,
      conditions: parsed.data.conditions,
      actions: parsed.data.actions,
      enabled: parsed.data.enabled,
      priority: parsed.data.priority,
      repositoryId: parsed.data.repositoryId ?? null,
    },
  });

  logger.info("rule_created", { userId: user.id, ruleId: rule.id });

  return NextResponse.json({ rule }, { status: 201 });
}
