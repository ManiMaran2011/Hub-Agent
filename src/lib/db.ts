import { PrismaClient } from "@prisma/client";

// Standard Next.js + Prisma pattern: reuse a single client across hot
// reloads in dev, and across warm serverless invocations in production,
// instead of exhausting the DB connection pool.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
