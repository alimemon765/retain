# Retain — Your Deployment Checklist

Everything below is **your** part. The code is done, tested, and committed. This
gets it onto Supabase + Vercel and onto your phone. Budget ~15 minutes.

Work top to bottom. Each step says exactly what to click/type and how to know it worked.

---

## Step 1 — Create the Supabase database

1. Go to **https://supabase.com** → sign in → **New project**.
2. Fill in:
   - **Name**: `retain` (anything).
   - **Database password**: click Generate, then **copy it somewhere safe** —
     you need it in Step 2 and can't see it again later.
   - **Region**: **South Asia (Mumbai) `ap-south-1`** — closest to you, lowest latency.
3. Click **Create new project** and wait ~2 minutes for it to finish provisioning.

---

## Step 2 — Get the two connection strings

1. In your project, go to **Settings** (gear, bottom-left) → **Database**.
2. Find the **Connection string** section. You need **two** URLs:

   **A) Pooled** (this is the app's main connection):
   - Choose the **Transaction** pooler tab (port **6543**).
   - It looks like:
     `postgresql://postgres.abcdxyz:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`
   - Replace `[YOUR-PASSWORD]` with the password from Step 1.
   - **Add this to the end**: `?pgbouncer=true&connection_limit=1`
   - Final result:
     `postgresql://postgres.abcdxyz:MyPass@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1`

   **B) Direct** (used only when creating tables):
   - Choose the **Session** pooler tab (port **5432**), OR the "Direct connection" option.
   - Same format but **port 5432** and **no** `?pgbouncer=...` suffix:
     `postgresql://postgres.abcdxyz:MyPass@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`

> Why two? The pooled one (6543) survives Vercel's serverless functions opening
> hundreds of short-lived connections. The direct one (5432) is what Prisma needs
> to run migrations. This is already wired up in the code.

---

## Step 3 — Put the strings in `.env` and create the tables

1. Open `/Users/ali/retain/.env` in an editor.
2. Replace the two lines that currently point at `localhost:54329`:

   ```
   DATABASE_URL="<your pooled URL from Step 2A>"
   DIRECT_URL="<your direct URL from Step 2B>"
   ```

3. **Change the PIN** on the `APP_PIN` line to your own number (4–8 digits):

   ```
   APP_PIN="your-real-pin"
   ```

4. In a terminal, from the `/Users/ali/retain` folder, run:

   ```bash
   npx prisma migrate deploy
   ```

   ✅ **Worked if** you see `All migrations have been successfully applied.`
   This creates your tables in Supabase. **Do not** run the seed command — you
   want to start with a clean, empty database (no dummy DAA/FLAT data).

---

## Step 4 — Push the code to GitHub

1. Create a new **private** repo on GitHub called `retain` (don't add a README —
   the repo already has one).
2. From `/Users/ali/retain`, run (swap in your GitHub username):

   ```bash
   git remote add origin https://github.com/YOUR-USERNAME/retain.git
   git push -u origin main
   ```

   ✅ **Worked if** GitHub shows your files. Note: `.env` is gitignored, so your
   passwords and keys are **not** pushed — that's correct and intentional.

---

## Step 5 — Deploy on Vercel

1. Go to **https://vercel.com** → sign in with GitHub → **Add New… → Project**.
2. Import your `retain` repo. Leave the framework preset as **Next.js**.
3. **Before clicking Deploy**, expand **Environment Variables** and add these
   **seven**. Copy the values straight out of your `/Users/ali/retain/.env` file
   (open it side by side):

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | your pooled URL (Step 2A) |
   | `DIRECT_URL` | your direct URL (Step 2B) |
   | `APP_PIN` | your PIN |
   | `CRON_SECRET` | copy the value already in `.env` |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | copy from `.env` |
   | `VAPID_PRIVATE_KEY` | copy from `.env` |
   | `VAPID_SUBJECT` | copy from `.env` (`mailto:ali.memon1507@gmail.com`) |

4. Click **Deploy**. Wait ~2 minutes.

   ✅ **Worked if** you get a live URL like `https://retain-xxxx.vercel.app` and
   opening it shows the **PIN screen**. Enter your PIN → you should land on the
   (empty) Today screen.

> The daily 7:00 AM reminder cron is already configured in `vercel.json` — Vercel
> picks it up automatically, no dashboard setup needed.

---

## Step 6 — Install on your phone

1. On your Android phone, open the Vercel URL in **Chrome**.
2. Enter your PIN (you won't have to again for 30 days on this device).
3. Chrome menu (⋮) → **Add to Home screen** → **Install**.
4. Open **Retain** from the new home-screen icon (not the browser tab — the
   installed app is what makes notifications work).

---

## Step 7 — Turn on notifications and test them

1. In the app, tap the **⚙ gear** next to the day name on the Today screen.
2. Tap **Enable notifications** → **Allow** when the phone asks.
3. Tap **Send test notification**.

   ✅ **Worked if** a "Test notification — push is working." notification appears
   on your phone within a few seconds.

That's it. From now on you'll get a daily 7:00 AM reminder whenever you have
topics due, and the app opens straight to what you need to revise.

---

## If something breaks

- **PIN screen won't accept my PIN** → the `APP_PIN` value in Vercel must exactly
  match what you type (no quotes, no spaces). Re-check the env var, then redeploy.
- **App loads but shows a server error** → almost always a bad `DATABASE_URL`.
  Confirm the password is right and the `?pgbouncer=true&connection_limit=1`
  suffix is on the pooled URL. Change the env var in Vercel → redeploy.
- **Test notification says "no subscriptions received it"** → you tapped test
  before Enable finished, or notifications are still blocked. Toggle disable →
  Enable again, allow the prompt, then retest.
- **iPhone instead of Android** → push only works *after* Add to Home Screen, and
  you must open it from the installed icon. The Settings screen already explains
  this. Everything else is identical.

## Later (optional)

- **Change your PIN**: update `APP_PIN` in Vercel → redeploy. (You'll re-enter it
  on your phone once.)
- **Wipe and restart data**: nothing to do — you're already starting clean. To
  clear everything later, delete rows from the Supabase Table Editor.
