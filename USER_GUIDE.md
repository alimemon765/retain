# Retain — Features & User Guide

Your personal spaced-repetition study tracker. Log what you study, and Retain
tells you exactly what to revise each day so it actually sticks.

---

## The core idea

You don't decide when to revise — the app does, using the **SM-2 spaced
repetition algorithm** (the same family Anki uses). Every time you review a
topic and rate how well you knew it, Retain schedules the next review at a
smartly expanding interval: harder topics come back soon, easy ones drift
weeks or months out. This is proven to beat cramming for long-term retention.

**Daily loop:** study → log the topic → each morning open Retain → revise
what's due → rate yourself → repeat.

---

> **Phase 2:** Retain now tracks four domains — Study, DSA problems, Books,
> and Skills. The nav is Today / Log / Calendar / **Progress** / **Library**:
> - **Log** has four segments: Topic · Problem · Reading · Skill.
> - **Today** adds DSA re-solves (old insight hidden until you Reveal — attempt
>   it fresh, then rate Clean / Struggled / Hint / Looked up), a one-line
>   reading nudge, and a quarterly skill-review banner every ~90 days.
> - **Progress** (was Stats) has tabs per domain: review-load forecast,
>   retention trend, pattern mastery (worst first — that's your study plan),
>   a "Build me a practice set" button (5 problems, deliberately mixed
>   patterns), reading pace, and a skills radar. Plus a cross-domain activity
>   heatmap.
> - **Library** (was Subjects) holds Subjects & Topics, Problems, Books
>   (highlights on technical books have **Add to revision** — the idea enters
>   your SM-2 queue), and Skills (levels change only in the quarterly review).

## The five screens

### 1. Today (home)
Your daily driver. Shows everything due today.

- **Date + streak** at the top. The streak counts consecutive days you've
  reviewed at least one topic.
- **Due topics**, grouped by subject with colored chips.
- **Overdue topics float to the top** with an "overdue Xd" badge — they're
  never hidden, so nothing slips.
- **Tap a card** to expand its notes and self-test questions.
- **Self-test questions** show the prompt only; tap **Reveal** to see the
  answer — this forces active recall instead of passive re-reading.
- **Four rating buttons** on each card: **Again · Hard · Good · Easy**. One tap
  records the review, the card slides away, and you briefly see when it's next
  due ("Next: 7 days").
- **All done?** You get "All clear. N topics reviewed today" and your streak.
- **+ button** (bottom-right) jumps to the Log screen.
- **⚙ gear** (next to the date) opens Settings.

### 2. Log a topic
Fast entry — built for logging 4–6 topics after a college day.

- **Subject**: pick an existing one, or tap **+ new** to create one with a
  color on the spot.
- **Topic name**: what you studied.
- **Source**: toggle **College** or **Self** (self-study).
- **Date studied**: defaults to today; change it if you're logging something
  from earlier.
- **Notes** (optional): key points, resource links, anything.
- **Self-test questions** (optional but recommended): add a few question +
  answer pairs to quiz yourself on later.
- **Submit** → toast confirms "Scheduled: first review tomorrow." The form
  keeps your subject and date so you can immediately log the next topic.

Every new topic's **first review is scheduled for tomorrow.**

### 3. Calendar
See your upcoming revision load at a glance.

- **Month grid** with a count on each day showing how many reviews are due.
- **Color intensity**: grey (light day) → gold (getting busy, 5+) → red
  (heavy, 10+).
- **Tap any day** → a sheet slides up listing every topic due that day.
- **Exam dates** are marked with a colored dot.
- Arrows move between months.

### 4. Subjects
Manage everything per subject.

- Each subject shows its **topic count** and **% mastered**.
- **Tap to expand** → see all its topics with their status, current interval,
  and next review date.
- **Set an exam date** here (this powers Exam Mode — see below).
- Per topic you can **edit** the name, **suspend/resume** it (suspended topics
  stop being scheduled), or **delete** it.

### 5. Stats
Track your consistency and how well it's working.

- **Current streak · Longest streak · Total reviews · Retention (30d)**.
  Retention = the % of reviews in the last 30 days you rated Good or Easy —
  your "am I actually remembering this" number.
- **Activity heatmap**: GitHub-style grid of the last 6 months; darker = more
  reviews that day.
- **Per-subject breakdown**: topics, total reviews, and mastered % for each.

---

## How the scheduling works (the four ratings)

When you review a topic, your rating decides the next interval:

| Rating | What it means | Effect |
|---|---|---|
| **Again** | I forgot it | Resets — back tomorrow, and it gets "harder" so it repeats more often |
| **Hard** | I struggled | Small increase (~×1.2), slightly harder |
| **Good** | I knew it | Normal expansion: 1 → 3 → 7 days, then multiplies out |
| **Easy** | Too easy | Big jump (extra 30%) and marked easier so it drifts far out |

- Intervals grow **1 day → 3 days → 7 days** for your first three "Good"
  reviews, then multiply based on how easy the topic is for you.
- Maximum interval is capped at **180 days** — nothing disappears forever.
- A topic becomes **Mastered** once you've reviewed it well 6+ times and it's
  reached a 60+ day interval. Mastered topics still come back occasionally but
  are visually dimmed so you focus on newer material.

### Load balancing
If a single day would pile up with 10+ reviews, Retain automatically nudges
some to a neighbouring lighter day (never earlier than tomorrow), so you never
get an unmanageable wall of reviews.

### Exam Mode
Set an **exam date** on a subject (in Subjects), and when the exam is **within
21 days**, Retain shifts gears for that subject:

- Any topic that would normally be reviewed *after* the exam gets **pulled
  forward** so you see it at least once before the exam.
- The Today screen shows a banner: *"DAA exam in 9 days — 14 topics on track,
  3 pulled forward."*
- After the exam date passes, scheduling **automatically returns to normal** —
  nothing to reset.

---

## Reminders & notifications

- The app itself is your primary reminder: open it each morning and the due
  list is right there.
- **Daily push notification** (optional): enable it in **Settings** and you'll
  get a notification every day at **7:00 AM IST** telling you how many topics
  are due — only on days you actually have reviews.
- Turn it on: open the installed app → ⚙ Settings → **Enable notifications** →
  Allow → optionally **Send test notification** to confirm.

---

## Install it on your phone (PWA)

1. Open the app URL in **Chrome** (Android) / **Safari** (iPhone).
2. Unlock with your PIN.
3. **Android**: ⋮ menu → **Add to Home screen** → Install.
   **iPhone**: Share button → **Add to Home Screen**.
4. Launch it from the new home-screen icon — always open it this way, not the
   browser tab (notifications and offline mode only work from the installed app).

### Works offline
The Today list stays viewable without signal, and any ratings you make offline
are **queued and automatically synced** the moment you're back online — so you
can revise on the metro and it'll catch up later.

---

## Privacy

The whole app sits behind a single **PIN**. Enter it once and you stay unlocked
on that device for 30 days. It's your private study log — no accounts, no
sharing, just you.

---

## A good daily rhythm

1. **After each study session** (lecture or self-study), open Log and add the
   topic — plus 2–3 self-test questions while it's fresh in your head.
2. **Every morning**, open Retain and clear the Today list: reveal each
   question, answer it in your head, then rate honestly.
3. **Be honest with ratings** — "Good" when you actually knew it, "Again" when
   you blanked. The algorithm only works if the ratings are truthful.
4. **Check Stats weekly** to watch your streak and retention climb.
5. **Set exam dates** as they get scheduled so Exam Mode can prep you in the
   final 3 weeks.

That's it. Log honestly, review daily, trust the schedule.
