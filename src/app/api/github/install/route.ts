import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { buildAuthOptions } from "@/lib/auth";
import { getInstallationUrl } from "@/lib/github/app";
import { getEnv } from "@/lib/env";

export async function GET(request: NextRequest) {
  const session = await getServerSession(buildAuthOptions());
  const env = getEnv();

  if (!session?.user) {
    const loginUrl = new URL("/login", env.APP_URL);
    loginUrl.searchParams.set("callbackUrl", "/api/github/install");
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(getInstallationUrl());
}
