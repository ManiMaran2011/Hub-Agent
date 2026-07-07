import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const installations = await prisma.installation.findMany({
    where: { userId: user.id },
    include: {
      repositories: {
        include: { _count: { select: { events: true } } },
        orderBy: { fullName: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ installations });
}
