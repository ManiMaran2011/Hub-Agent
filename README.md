# GHOps Bot

A bot that watches a GitHub repository, reacts to issues/PRs/pushes
according to rules you configure, writes back to GitHub (labels,
comments), pings Slack, and optionally triages issues/PRs with Gemini —
all visible on a live dashboard behind GitHub login.

**Live app:** _add your deployed URL here before submitting_
**Repo:** _add your repo URL here before submitting_

---

## What it actually does

1. Sign in with GitHub.
2. Click **Connect a repository** → install the GHOps Bot GitHub App on
   exactly the repo(s) you choose.
3. Write a rule on the **Rules** page, e.g.:
   > Issues whose **title contains** `bug` → **add label** `bug` + **send
   > Slack alert**
4. Open a matching issue on the connected repo. Within a few seconds:
   - the label shows up on GitHub,
   - a Block Kit message lands in your Slack channel (color-coded by
     AI-assessed priority if AI triage is configured),
   - the event appears on the **Activity** dashboard as a node on a
     git-log-style timeline, with each action (label / comment / Slack)
     shown as its own branch with a pass/fail status.

If nothing matches, the event still shows up as `ignored` — nothing is
silently dropped.

## Why it's built the way it is

The assessment's real ask is reliability, not just "make the happy path
work." Three design choices carry that weight:

- **Idempotency via a unique constraint.** `Event.deliveryId` (GitHub's
  `X-GitHub-Delivery` header) is unique in the DB. A redelivered webhook —
  which GitHub does on timeout or 5xx — hits a Postgres unique-violation
  and acks without re-running any action. See
  `src/app/api/github/webhook/route.ts`.
- **Ack fast, process durably.** The webhook handler persists the event
  and returns 200 in well under a second, then processes it via Vercel's
  `waitUntil` so a slow downstream call (Slack, GitHub, Gemini) can't make
  GitHub think the webhook failed and retry unnecessarily. A Vercel Cron
  job (`/api/cron/retry`, every 5 minutes) sweeps anything that ended up
  `pending` too long, `failed` with a due retry time, or stuck
  `processing` from a crashed invocation — so a downstream outage delays
  things, but never loses them. See `src/lib/processing/`.
- **Per-action outcomes.** A GitHub label call and a Slack call can fail
  independently. Each has its own `ActionLog` row, so a partial failure
  shows up as exactly that on the dashboard — with a manual **Retry now**
  button — rather than an opaque "something failed."

Security specifics: webhook signatures are verified with
`crypto.timingSafeEqual` over the *raw* request body before any parsing
(`src/lib/github/webhook-verify.ts`); the dashboard is gated server-side
via `middleware.ts`, not just hidden client-side; every API route that
touches a rule or repository checks it belongs to the signed-in user; and
all secrets are read through one validated module
(`src/lib/env.ts`) so a misconfigured deploy fails loudly at startup
instead of leaking `undefined` into a header somewhere.

## Stretch goals implemented

- ✅ **Configurable rules UI** — full CRUD, condition/action builder, no
  hardcoded behavior (`src/components/dashboard/Rule*`).
- ✅ **AI triage** — Gemini 1.5 Flash summarizes, suggests labels, and
  assigns a priority, shown in both the Slack message and the dashboard
  (`src/lib/ai.ts`). Fully optional — the app works with
  `GEMINI_API_KEY` unset.
- ✅ **GitHub App** (JWT + installation tokens) instead of a plain OAuth
  App, used for both login and repo access (`src/lib/github/app.ts`).
- ✅ **Multi-repository support** — a GitHub App installation can grant
  access to multiple repos at once; rules can target one repo or "all
  connected repos."
- ✅ **Observability** — structured JSON logs (`src/lib/logger.ts`),
  per-action status history, retry counts, and last error visible on the
  dashboard, not just in logs.

## Tech stack

Next.js 14 (App Router, TypeScript) · Prisma + Postgres (Neon) ·
NextAuth (JWT sessions) · Octokit + `@octokit/auth-app` · Slack Web API
(Block Kit) · Google Gemini · Tailwind CSS · Vercel (hosting + Cron)

Everything here has a free tier with no card required, per the
assessment's constraints.

---

## Local setup

### 1. Clone and install

```bash
git clone <your-repo-url>
cd ghops-bot
npm install
cp .env.example .env
```

### 2. Database (Neon, free, no card)

1. Create a project at [neon.tech](https://neon.tech).
2. Copy the **pooled** connection string into `DATABASE_URL` and the
   **direct** connection string into `DATABASE_URL_UNPOOLED` in `.env`.
3. Push the schema:
   ```bash
   npm run db:push
   ```

### 3. GitHub App

1. Go to <https://github.com/settings/apps/new>.
2. **Homepage URL**: your deployed URL (or `http://localhost:3000` for
   local-only testing — see the ngrok note below for webhooks).
3. **Callback URL**: `<APP_URL>/api/auth/callback/github`
4. **Setup URL** (under "Post installation"): `<APP_URL>/api/github/install/callback`,
   and check **"Redirect on update"**.
5. **Webhook URL**: `<APP_URL>/api/github/webhook`. Generate a random
   secret (`openssl rand -hex 20`) and put it in both the GitHub App
   settings and `GITHUB_APP_WEBHOOK_SECRET`.
6. **Permissions** (Repository permissions): Issues → Read & write,
   Pull requests → Read & write, Contents → Read-only, Metadata →
   Read-only.
7. **Subscribe to events**: Issues, Pull request, Push, Installation,
   Installation repositories.
8. Create the app, then:
   - copy the **App ID** → `GITHUB_APP_ID`
   - copy the **Client ID** → `GITHUB_APP_CLIENT_ID`
   - generate a **Client secret** → `GITHUB_APP_CLIENT_SECRET`
   - generate a **private key** (.pem), open it, and paste the full
     contents into `GITHUB_APP_PRIVATE_KEY` (literal newlines are fine in
     a local `.env`; on Vercel, paste with `\n` escapes — see the comment
     in `.env.example`)
   - note the app's URL slug (from `github.com/apps/<slug>`) →
     `GITHUB_APP_SLUG`

### 4. Slack

1. Create an app at <https://api.slack.com/apps> → **From scratch**.
2. Under **OAuth & Permissions**, add the `chat:write` bot scope, install
   the app to your workspace, and copy the **Bot User OAuth Token** →
   `SLACK_BOT_TOKEN`.
3. Invite the bot to a channel (`/invite @your-bot-name`), then copy that
   channel's ID (right-click the channel → View channel details) into
   `SLACK_CHANNEL_ID`.

### 5. AI triage (optional)

Get a free key at <https://aistudio.google.com/app/apikey> → `GEMINI_API_KEY`.
Leave blank to skip; the rest of the app is unaffected.

### 6. Auth secret + cron secret

```bash
openssl rand -base64 32   # → NEXTAUTH_SECRET
openssl rand -hex 20      # → CRON_SECRET
```

### 7. Run it

```bash
npm run dev
```

Webhooks need a publicly reachable URL, so for *local* end-to-end testing
either deploy first (recommended — see below) or tunnel with
[ngrok](https://ngrok.com) (`ngrok http 3000`) and use the ngrok URL as
`APP_URL`/`NEXTAUTH_URL` and in the GitHub App's Webhook/Callback/Setup
URLs while testing.

---

## Deployment (how this was actually deployed)

1. Push this repo to GitHub.
2. Import it on [Vercel](https://vercel.com) (free tier, no card).
3. Add every variable from `.env.example` under **Project Settings →
   Environment Variables** — including `CRON_SECRET`, which Vercel uses
   automatically to authenticate its own Cron requests to
   `/api/cron/retry` once set.
4. Deploy. Vercel picks up `vercel.json`'s cron config automatically (runs
   every 5 minutes).
5. Update the GitHub App's Homepage/Callback/Setup/Webhook URLs to the
   real Vercel URL, and `APP_URL`/`NEXTAUTH_URL` in Vercel's env vars to
   match.
6. Run `npm run db:push` once against the production `DATABASE_URL`
   (from your machine, with the production `.env` values) to create the
   schema on Neon.

## How to test this

1. Open the deployed URL, sign in with GitHub.
2. **Repositories** → **Connect a repository** → pick a repo you own (a
   throwaway test repo is easiest).
3. **Rules** → **New rule** → e.g. event type `Issues`, condition
   `title contains bug`, actions `Add label: bug` + `Send Slack alert`.
4. On GitHub, open an issue on the connected repo with "bug" in the
   title.
5. Within ~5 seconds: the label appears on GitHub, a Slack message
   arrives, and the event appears on **Activity**.
6. To see the retry path: temporarily revoke the Slack bot token or point
   `SLACK_CHANNEL_ID` at a channel the bot isn't in, fire another event,
   and watch it land as `partial` (label succeeded, Slack failed) with a
   **Retry now** button — fix the token and retry to see it resolve to
   `success`.
7. Redeliver the same webhook from GitHub's **Settings → Advanced** on
   the App (or from the repo's webhook delivery log) to confirm it's
   acknowledged without creating a duplicate event or a second Slack
   message.

## Project structure

```
src/
  app/
    api/
      auth/[...nextauth]/     — NextAuth (GitHub App OAuth)
      github/webhook/         — signature verification + ingestion
      github/install/         — install redirect + setup callback
      cron/retry/             — retry sweep (Vercel Cron)
      rules/, events/, repos/ — dashboard data APIs
    dashboard/                — Activity / Rules / Repositories pages
    login/, page.tsx          — public landing + login
  components/
    timeline/                 — the git-log-style event feed
    dashboard/                — rule builder, repos panel
  lib/
    github/                   — app auth, normalize, actions, install sync
    processing/                — event pipeline + backoff schedule
    ai.ts, slack.ts, rules-engine.ts, template.ts
    env.ts, db.ts, logger.ts, auth.ts, session.ts
prisma/schema.prisma
```

## Known limitations (honest, not hidden)

- An `installation` webhook that arrives *before* the user completes the
  install callback (e.g. an org member installs directly from GitHub's
  Marketplace without going through this app's "Connect" button) can't
  be safely attributed to a user, since ownership is only knowable from
  the authenticated session at callback time. It's logged and skipped;
  the repo shows up once the user does click "Connect" in-app. Documented
  in `lib/github/installations.ts`.
- Rule conditions are AND-only (no OR groups) in v1 — see "what I'd add
  with more time" in `AI_NOTES.md`.
- `User.accessToken` is stored in plaintext in Postgres. For this
  exercise's scope that token is only ever used to populate the login
  profile, not to act on the user's behalf elsewhere — but encrypting it
  at rest (or dropping the column entirely, since it's unused post-login)
  would be the right move before this handled real user data.
