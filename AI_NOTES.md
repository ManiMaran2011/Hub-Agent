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

Before any of this touched a live deployment, Claude's own sandbox couldn't
reach Prisma's binary CDN to run `prisma generate`, so it hand-built a
throwaway type stub matching the real schema to get a genuine `tsc`
pass rather than skipping verification — that caught two `undefined`-safety
bugs in `lib/github/actions.ts` before they ever shipped. Useful, but a
different category of finding than the two below, which only showed up
once real traffic hit the real deployment.

## The hardest thing that came up

Two real issues surfaced, and both only showed up once the app was actually
deployed and used against real GitHub/Slack/Gemini traffic — neither was
visible from reading the code, which is itself the point of end-to-end
testing rather than stopping at "it type-checks."

**1. A self-inflicted feedback loop.** `normalize.ts` originally treated
`issues.labeled` as an "actionable" trigger, same as `opened`/`edited`.
That seemed reasonable in isolation. In practice: the bot's own
`addLabel` call, once it succeeds, causes GitHub to fire a *second*,
distinct webhook (`issues.labeled`) for the label it just added. That
event matched the same rule again ("title contains bug" — the title
hadn't changed) and re-ran every action. The label add itself was
harmless (idempotent — already-present labels are skipped), but Slack
got hit twice per issue. This is not the "delivery redelivered" case the
idempotency logic already covers — it was two *different*, legitimate
delivery IDs, so the unique-constraint guard correctly let both through.
The actual bug was scope: a bot should never treat its own write-back as
a fresh trigger. Fix: dropped `"labeled"` from the actionable-actions
list, and added a second, general guard in the webhook route that skips
any event where `sender.type === "Bot"`, as a backstop for whatever event
type gets added next.

**2. Gemini 1.5 was fully retired.** AI triage was wired up to
`gemini-1.5-flash` and passed every check I could run without a live key
— schema validation, error handling, the works. It still didn't work in
production: Google shut down all Gemini 1.0 and 1.5 models earlier this
year, so every call 404'd. The code's own fail-safe design is what made
this a non-event instead of an outage — the failure was caught, logged
with the real error, and the rest of the pipeline (label, Slack)
completed normally with AI triage simply absent. We only found the exact
cause by reading Vercel's runtime logs rather than guessing, which
surfaced the literal 404 and a later transient 503 ("high demand") from
Google's side — a genuinely different, temporary failure that resolved
on retry. Fixed by moving to `gemini-2.5-flash`, the current stable
model as of this deployment.

Both bugs share a lesson: a system that fails loudly and specifically (structured
logs with the real error, not a generic "something went wrong") turns a
silent gap into a two-minute diagnosis. The parts of this build that paid
off hardest under real testing were the ones designed for failure to be
visible, not the ones designed to avoid failure entirely.

The honest caveat that remains: this was tested against one repository,
one Slack workspace, and a handful of manually-created issues/PRs — not
load, not concurrency, not an organization's real webhook volume. What's
verified is the *shape* of the reliability story (idempotency, retries,
partial failure, graceful AI degradation), each demonstrated at least
once against the real live deployment, not simulated.

## What I'd improve with more time

- A single retry-with-backoff around the Gemini call itself for transient
  errors (503 "high demand," specifically — seen once during live
  testing, resolved on the next attempt with no code change). Right now
  a transient AI provider hiccup just means that one event's triage is
  silently skipped rather than retried a few seconds later, even though
  the rest of the retry infrastructure already exists for GitHub/Slack.
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