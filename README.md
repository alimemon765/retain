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

## Deploying to Vercel

1. Create a Supabase project (region `ap-south-1` is closest to IST), grab
   both connection strings from Project Settings → Database.
2. `DIRECT_URL=<direct> DATABASE_URL=<pooled> npx prisma migrate deploy`
   (run once from your machine to create the tables).
3. Push the repo to GitHub, import into Vercel, and set env vars:
   `DATABASE_URL`, `DIRECT_URL`, `APP_PIN`, `CRON_SECRET`,
   `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
4. `vercel.json` registers the daily cron (01:30 UTC = 07:00 IST); Vercel
   sends `CRON_SECRET` as the bearer token automatically.
5. On your phone: open the URL → Add to Home Screen → Settings (gear on
   Today) → Enable notifications → Send test notification.
