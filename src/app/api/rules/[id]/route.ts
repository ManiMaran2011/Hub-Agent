import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { ruleInputSchema } from "@/lib/validation/rule";
import { logger } from "@/lib/logger";

async function loadOwnedRule(ruleId: string, userId: string) {
  return prisma.rule.findFirst({ where: { id: ruleId, userId } });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const existing = await loadOwnedRule(params.id, user.id);
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  // Partial updates are common (e.g. just toggling `enabled`), so we
  // validate against the full schema but allow the client to omit fields
  // by merging onto the existing row first.
  const merged = {
    name: body?.name ?? existing.name,
    eventType: body?.eventType ?? existing.eventType,
    conditions: body?.conditions ?? existing.conditions,
    actions: body?.actions ?? existing.actions,
    enabled: body?.enabled ?? existing.enabled,
    priority: body?.priority ?? existing.priority,
    repositoryId: body?.repositoryId !== undefined ? body.repositoryId : existing.repositoryId,
  };

  const parsed = ruleInputSchema.safeParse(merged);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid rule", details: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.repositoryId) {
    const repo = await prisma.repository.findFirst({
      where: { id: parsed.data.repositoryId, installation: { userId: user.id } },
    });
    if (!repo) {
      return NextResponse.json({ error: "repository not found or not connected by you" }, { status: 403 });
    }
  }

  const rule = await prisma.rule.update({
    where: { id: existing.id },
    data: {
      name: parsed.data.name,
      eventType: parsed.data.eventType,
      conditions: parsed.data.conditions,
      actions: parsed.data.actions,
      enabled: parsed.data.enabled,
      priority: parsed.data.priority,
      repositoryId: parsed.data.repositoryId ?? null,
    },
  });

  logger.info("rule_updated", { userId: user.id, ruleId: rule.id });
  return NextResponse.json({ rule });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const existing = await loadOwnedRule(params.id, user.id);
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.rule.delete({ where: { id: existing.id } });
  logger.info("rule_deleted", { userId: user.id, ruleId: existing.id });

  return NextResponse.json({ ok: true });
}
