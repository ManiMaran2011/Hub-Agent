# AI_NOTES.md

## Tools and split of work

Built almost entirely with **Claude** (Sonnet 5, in Claude.ai's chat +
code sandbox) in a single extended session. I set the scope and made the
calls that actually shape the product; Claude wrote essentially all of
the code, designed the file layout, and did its own verification pass
before handing it back. Roughly: I decided *what this had to be true to*
(reliability semantics, which stretch goals, visual direction); Claude
decided *how to make that true* and implemented it. I did not hand-write
any files in this repo — `CLAUDE.md` in the repo root documents the
conventions Claude settled on and followed throughout, written as it went
rather than staged upfront.

## Key decisions I made myself

1. **GitHub App over a plain OAuth App**, even though it's more setup
   work, because it gets multi-repo support and properly scoped,
   short-lived tokens essentially for free, and it's the integration
   pattern GitHub itself recommends for anything acting on a user's repos
   long-term rather than just reading their profile.
2. **One Next.js app on Vercel instead of a separate always-on backend.**
   The tradeoff is that "process asynchronously after ack" isn't a real
   background worker — it's `waitUntil` plus a cron sweep as the
   durability backstop. For this project's actual event volume that's the
   right tradeoff; I'd revisit if this needed to handle a busy
   organization's webhook volume instead of a demo repo.
3. **AND-only rule conditions, GitHub App + Slack + Gemini as the three
   integrations** (skipping a second notification channel like Telegram).
   Depth on fewer integrations, done correctly with real failure-mode
   handling, seemed like a better use of the time budget than breadth
   across more surface area.

## The hardest thing that came up

Not a wrong turn in the usual "AI hallucinated an API" sense — the actual
hardest moment was that Claude's own sandbox couldn't reach
`binaries.prisma.sh` (blocked by the sandbox's network allowlist), so
`prisma generate` failed outright and most of the codebase — anything
touching `@prisma/client` types — couldn't be type-checked normally.

The easy failure mode there is to just eyeball the Prisma-dependent code
and assume it's fine. Instead, Claude hand-wrote a throwaway `.d.ts` stub
matching the real generated shapes (the enums and model fields from
`schema.prisma`) and dropped it into `node_modules/.prisma/client/` to get
`tsc --noEmit` running for real against the actual application code, then
deleted the stub once it had served its purpose. That run caught two real
bugs: `owner`/`repo` from `fullName.split("/")` are typed as
`string | undefined` in strict TypeScript, and the code passed them
straight to Octokit's typed methods, which expect `string`. Harmless on
almost every real repo full name, but a legitimate crash if a repository
name were ever malformed — worth fixing rather than silencing with a cast.
I only know this happened because the transcript shows the failed
install, the stub, the two errors, and the fix — not because I re-derived
it after the fact.

The honest caveat: I have not run this against a live GitHub App,
Slack workspace, or Neon database end-to-end, because doing so requires
accounts and secrets that only I can create. What's verified is that it
type-checks cleanly against Prisma's real generated types, lints clean,
and every module's logic (signature verification, idempotency via the
unique `deliveryId` constraint, the retry/backoff schedule, the rules
engine's matching semantics) was reasoned through explicitly rather than
assumed. The remaining risk is entirely in the "did I configure the
GitHub App's permissions/webhook events exactly right" category, which
the README's setup walkthrough is written to minimize.

## What I'd improve with more time

- OR-groups in the rules engine (currently AND-only across conditions).
- A second notification channel (Telegram, per the suggested services)
  behind the same `RuleAction` union, to prove the action model
  generalizes past Slack.
- Encrypt `User.accessToken` at rest, or drop it — it's currently unused
  after login and is the one field in this schema I'd flag in a security
  review.
- An actual live smoke test script (`scripts/smoke-test.ts`) that fires a
  synthetic, correctly-signed webhook at a running instance, so
  "does it work end-to-end" doesn't rely entirely on manual clicking.
