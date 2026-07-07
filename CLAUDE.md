# CLAUDE.md — working conventions for GHOps Bot

This file documents the conventions actually followed while building this
repo, so any future session (human or AI) touching this code stays
consistent with the reasoning already baked into it. It was authored
*during* the build to capture decisions as they were made, not handed to
the AI beforehand — see AI_NOTES.md for how that worked in practice.

## Non-negotiables (the assessment's quality bar, operationalized)

1. **Webhook signature verification happens before anything else touches
   the request.** Read `request.text()` once, verify HMAC with
   `crypto.timingSafeEqual`, and only then `JSON.parse`. Never re-derive
   the signature from re-serialized JSON — it will not match GitHub's.
2. **Idempotency is a unique DB constraint, not a "best effort" check.**
   `Event.deliveryId` is `@unique`. A redelivered webhook must hit the
   `P2002` catch branch and ack without reprocessing — not silently
   duplicate a Slack message or a GitHub comment.
3. **Ack fast, process after.** The webhook route should return 200 within
   a couple seconds. Anything that calls an LLM, GitHub's API, or Slack
   happens via `waitUntil(processEvent(...))` after the response is
   already queued, or in the cron retry sweep — never inline and blocking
   before the response.
4. **Every side effect gets its own `ActionLog` row.** If a Slack call
   fails but the label succeeded, that must show as `partial` with one
   green action and one red action — never collapse to a single
   success/fail boolean on the Event.
5. **Secrets never leave `lib/env.ts`.** No `process.env.X` scattered
   through route handlers or components. If a new secret is needed, add it
   to the `serverEnvSchema` in `lib/env.ts` and `.env.example` with a
   comment on where to get it, in the same commit.
6. **Nothing acts on a repo the current user doesn't own.** Every route
   that touches a `Rule` or `Repository` filters through
   `installation.userId === session.user.id` — see `lib/session.ts` and
   the ownership checks in `app/api/rules/*`.

## Architecture shape

- **One Next.js App Router project.** No separate backend service — API
  routes under `src/app/api/*` are the backend.
- **GitHub App, not OAuth App**, for both login and repo access (see
  `lib/auth.ts` and `lib/github/app.ts` for why — one integration instead
  of two, and installation tokens are properly scoped).
- **Normalize before storing.** Raw GitHub payloads are large and
  shape-inconsistent across event types. `lib/github/normalize.ts`
  converts everything into the stable `NormalizedEvent` shape *before* it
  reaches the rules engine, AI triage, or the DB. Nothing downstream of
  that boundary should ever touch a raw payload field like
  `payload.issue.user.login` directly.
- **The rules engine takes typed input, not DB rows.** `lib/rules-engine.ts`
  operates on `EvaluableRule[]`, decoupled from Prisma. If a second
  storage backend or a test suite needs to evaluate rules, it shouldn't
  need a database.
- **AI triage degrades to `null`, never throws.** Every call site checks
  for `null` and keeps going. AI triage is enrichment, not a dependency —
  the bot must fully function with `GEMINI_API_KEY` unset.

## Style

- Prefer small, single-purpose modules under `lib/` over large files.
  If a file starts doing two unrelated things, split it.
- Every non-obvious decision gets a comment explaining *why*, not *what* —
  the code already says what.
- Server-only logic never gets imported into a `"use client"` component's
  module graph, even transitively — that's how secrets end up in a
  browser bundle. `lib/env.ts`, `lib/db.ts`, `lib/github/*` are
  server-only; components fetch through API routes instead.
- No comments claiming something is "production-ready" or "enterprise
  grade" — let the code demonstrate that instead.

## What NOT to do here

- Don't add a message broker / Redis queue for the retry mechanism. The
  DB-status-column + cron-sweep pattern in `lib/processing/backoff.ts` is
  intentional for a project at this scale — swap it out only if there's
  an actual throughput problem, not preemptively.
- Don't loosen the rules engine to OR-across-conditions without also
  updating `lib/validation/rule.ts` and the builder UI — the two must stay
  in sync.
- Don't log full webhook payloads or full Slack/GitHub tokens, even at
  debug level. `lib/logger.ts` redacts common secret key names, but that's
  a backstop, not permission to log secrets deliberately.
