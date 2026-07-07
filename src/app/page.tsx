import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { buildAuthOptions } from "@/lib/auth";
import { SignInButton } from "@/components/auth/SignInButton";
import { TimelinePreview } from "@/components/marketing/TimelinePreview";

export default async function Home() {
  const session = await getServerSession(buildAuthOptions());
  if (session?.user) redirect("/dashboard");

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6">
      <nav className="flex items-center justify-between py-6">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-signal-info/15 font-mono text-sm font-medium text-signal-info">
            {"</>"}
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">GHOps Bot</span>
        </div>
        <SignInButton />
      </nav>

      <main className="flex flex-1 flex-col justify-center gap-16 py-16">
        <section className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-signal-info">
              issues · pull requests · pushes
            </p>
            <h1 className="font-display text-4xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-5xl">
              A control room for
              <br />
              what happens on your repo.
            </h1>
            <p className="mt-6 max-w-xl text-balance text-lg leading-relaxed text-ink-muted">
              Connect a repository, write a rule in plain terms — &ldquo;issues titled
              bug get labeled and posted to Slack&rdquo; — and watch every event GHOps
              Bot reacts to land on a live timeline, labeled, commented, and
              triaged automatically.
            </p>
            <div className="mt-8 flex items-center gap-4">
              <SignInButton size="lg" />
              <a
                href="https://github.com/settings/apps"
                target="_blank"
                rel="noreferrer"
                className="text-sm text-ink-muted underline decoration-border underline-offset-4 hover:text-ink"
              >
                How the GitHub App works ↗
              </a>
            </div>
          </div>
          <TimelinePreview />
        </section>

        <section className="grid gap-6 border-t border-border pt-12 sm:grid-cols-3">
          {[
            {
              n: "01",
              title: "Connect a repo",
              body: "Sign in with GitHub and install the GHOps Bot app on one repository — nothing broader.",
            },
            {
              n: "02",
              title: "Configure a rule",
              body: "Match on a title, author, label, or branch. Choose what happens: add a label, comment, or ping Slack.",
            },
            {
              n: "03",
              title: "Watch it react",
              body: "Every webhook lands on your dashboard with the exact action taken — success, retried, or failed.",
            },
          ].map((step) => (
            <div key={step.n} className="rounded-card border border-border bg-panel p-5">
              <span className="font-mono text-xs text-ink-faint">{step.n}</span>
              <h3 className="mt-2 font-display text-base font-semibold text-ink">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{step.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border py-6 text-xs text-ink-faint">
        Built for a take-home engineering exercise. Not affiliated with GitHub or Slack.
      </footer>
    </div>
  );
}
