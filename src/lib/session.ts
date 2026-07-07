import { getServerSession } from "next-auth";
import { buildAuthOptions } from "@/lib/auth";

export async function getCurrentUser() {
  const session = await getServerSession(buildAuthOptions());
  return session?.user ?? null;
}
