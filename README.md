# Retain

Personal spaced-repetition study tracker. Log what you study, review what's due
each day, rate yourself Again / Hard / Good / Easy, and SM-2 schedules the next
review. Single user, mobile-first PWA, dark theme.

## Run

```bash
npm install
npx prisma migrate deploy  # applies prisma/migrations to DATABASE_URL
npx prisma db seed         # optional dummy data
npm run dev
```

The database is Postgres (Supabase in production). `.env` currently points at
a local scratch instance; start it with:

```bash
$(brew --prefix postgresql@17)/bin/pg_ctl -D <pgdata-dir> -o "-p 54329" start
```

or just point `DATABASE_URL`/`DIRECT_URL` at Supabase for dev too.

## Test

```bash
npm test                 # Vitest — SM-2 + scheduler unit tests
```

## Environment (`.env`, see `.env.example`)

- `DATABASE_URL` — Supabase **pooled** connection (port 6543, with
  `?pgbouncer=true&connection_limit=1`) — serverless functions exhaust the
  direct connection limit fast.
- `DIRECT_URL` — Supabase direct connection (port 5432), used only by
  `prisma migrate`.
- `APP_PIN` — single-user PIN lock (proxy.ts + 30-day cookie). Empty
  disables the lock.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` —
  web push; generate with `npx web-push generate-vapid-keys`.
- `CRON_SECRET` — bearer token required by `/api/cron/daily`.

## Structure

- `lib/sm2.ts` — pure SM-2 rating → interval/ease logic (tested).
- `lib/scheduler.ts` — load balancing (≤10 reviews/day, ±1-day shift) and
  Exam Mode pull-forward (tested). Exam Mode is applied at **read time**: the
  DB always holds pure SM-2 dates, so scheduling reverts automatically after
  the exam.
- `lib/queries.ts` — read layer for the screens.
- `app/actions.ts` — server actions (create/review/CRUD).
- `app/api/review` — same review path over HTTP, used by the offline outbox.
- `lib/outbox.ts` + `public/sw.js` — offline: last good page snapshots are
  cached; ratings made offline queue in IndexedDB and flush on reconnect.
- `app/api/cron/daily` — daily push ("N topics to revise"), scheduled by
  `vercel.json` at 01:30 UTC = 07:00 IST.

## Day planner (Phase 3)

`/planner` turns fixed commitments plus everything Retain knows is due into a
scheduled day. `lib/planner.ts` is a pure function — no DB, no framework — so
the whole scheduler is unit tested.

- **Setup** (`/planner/setup`): timetable via bulk paste (`Mon 9-10.30 DAA`,
  `Tue 2pm-3:30pm DMM (odd weeks)`, `@ Room 204`), a per-day list with
  copy-to-day, or an add-one form. Plus sleep/commute, block sizing and slack.
- **Fixed blocks** are laid down first (locked > exception > class > sleep >
  travel > get-ready), then meals slide to the next gap if they collide.
- **Free time** is carved into blocks between min/max with breaks; slack is
  reserved proportionally so it spreads across the day rather than piling up
  at the end.
- **Placement** matches cognitive demand to time-of-day alertness (morning
  inertia, peak, post-lunch dip, second peak, wind-down). Hard work never
  lands in the wind-down hour; reviews batch into one block; DSA blocks
  interleave patterns using the same cap as the Phase 2 practice set.
- **Reviews are never dropped** — other categories overflow first.

### Why Google Calendar is the output layer

Ringing alarms and home-screen widgets are not possible from a PWA: there is
no Web Alarms API, Notification Triggers never shipped, and Android/iOS
widgets require a native app. So Retain computes the plan and Google Calendar
displays and announces it — its widget is the home-screen widget, and its
event notifications are the block-start reminders.

A calendar notification is a notification, not an alarm: it will not break
through silent/DND unless you allow that for Google Calendar on your phone.
Keep using your phone's real alarm clock to wake up.

### Google Cloud setup (one-time, free)

1. **console.cloud.google.com** → create a project.
2. **APIs & Services → Library** → enable **Google Calendar API**.
3. **OAuth consent screen** → External → keep it in **Testing** mode and add
   your own Google account as the sole test user. Testing mode needs no
   verification review, which is what you want for personal use.
4. **Credentials → Create credentials → OAuth client ID → Web application**.
   Authorised redirect URI:
   `https://<your-app>.vercel.app/api/gcal/callback`
   (add `http://localhost:3000/api/gcal/callback` too for local work).
5. Set env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL`
   (your deployed URL), and `ENCRYPTION_KEY`.
   `ENCRYPTION_KEY` **must be exactly 64 hex characters** (32 bytes for
   AES-256) — generate it with `openssl rand -hex 32`. It is validated at
   server startup by `instrumentation.ts`, so a malformed key fails the boot
   with a clear message instead of erroring the first time you connect.
   `APP_URL` must match the origin you registered above, because
   `redirect_uri` is built from it and Google compares it exactly.
6. In the app: **Plan → setup → Connect Google Calendar**.

Retain creates and writes to a dedicated secondary calendar named **Retain**,
never your primary one — so one toggle hides all of it, and a sync bug can
never touch real appointments. Only work blocks sync (plus classes, behind a
toggle); sleep, travel, meals, breaks and buffer are skipped as noise. Events
carry a popup reminder at 0 minutes, and regeneration patches existing events
rather than recreating them, so you don't get notification spam.

### The home-screen widget

On Android: long-press the home screen → Widgets → Google Calendar → place it,
then in Google Calendar's settings show only the **Retain** calendar (or leave
everything on to see your whole day). That is the widget — no native app needed.

## Deploying to Vercel

1. Create a Supabase project (region `ap-south-1` is closest to IST), grab
   both connection strings from Project Settings → Database.
2. `DIRECT_URL=<direct> DATABASE_URL=<pooled> npx prisma migrate deploy`
   (run once from your machine to create the tables).
3. Push the repo to GitHub, import into Vercel, and set env vars:
   `DATABASE_URL`, `DIRECT_URL`, `APP_PIN`, `CRON_SECRET`,
   `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`,
   and for the planner: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
   `APP_URL`, `ENCRYPTION_KEY`.
4. `vercel.json` registers the daily cron (01:30 UTC = 07:00 IST); Vercel
   sends `CRON_SECRET` as the bearer token automatically.
5. On your phone: open the URL → Add to Home Screen → Settings (gear on
   Today) → Enable notifications → Send test notification.
