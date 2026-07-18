# Retain

Personal spaced-repetition study tracker. Log what you study, review what's due
each day, rate yourself Again / Hard / Good / Easy, and SM-2 schedules the next
review. Single user, mobile-first PWA, dark theme.

## Run

```bash
npm install
npx prisma migrate dev   # creates prisma/dev.db
npx prisma db seed       # optional dummy data
npm run dev
```

## Test

```bash
npm test                 # Vitest — SM-2 + scheduler unit tests
```

## Environment (`.env`, see `.env.example`)

- `DATABASE_URL` — SQLite file path.
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

## Deployment note

SQLite lives on the local filesystem — that works on any persistent host but
**not on Vercel's serverless filesystem**. Before deploying to Vercel, switch
the Prisma datasource to Postgres (Supabase) — schema is portable, only
`datasource` + `DATABASE_URL` change, plus converting the `source`/`status`/
`rating` string columns to native enums if desired.
