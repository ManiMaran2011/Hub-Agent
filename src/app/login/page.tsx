import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { buildAuthOptions } from "@/lib/auth";
import { SignInButton } from "@/components/auth/SignInButton";

export default async function LoginPage() {
  const session = await getServerSession(buildAuthOptions());
  if (session?.user) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-card border border-border bg-panel p-8 text-center">
        <span className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-signal-info/15 font-mono text-base text-signal-info">
          {"</>"}
        </span>
        <h1 className="font-display text-xl font-semibold text-ink">Sign in to GHOps Bot</h1>
        <p className="mt-2 text-sm text-ink-muted">
          We use your GitHub account to know which repositories are yours to
          connect. We never see your password.
        </p>
        <div className="mt-6 flex justify-center">
          <SignInButton size="lg" />
        </div>
      </div>
    </div>
  );
}
