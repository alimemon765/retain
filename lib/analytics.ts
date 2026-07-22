import { differenceInCalendarDays } from "date-fns";
import { dayKey, dayPlus, localDay } from "./dates";

// Pure analytics computations for the Progress tabs. Framework-free and
// replayable so they're unit-testable.

export interface ForecastPoint {
  day: string; // yyyy-MM-dd
  label: string; // short display label, e.g. "24 Jul"
  count: number;
}

/**
 * Review load for the next `days` days. Anything overdue (or due today)
 * lands in today's bucket — that's the pile waiting for you.
 */
export function forecastLoad(
  dueDates: Date[],
  today: Date,
  days = 30
): ForecastPoint[] {
  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i++) buckets.set(dayKey(dayPlus(today, i)), 0);
  for (const d of dueDates) {
    const day = localDay(d);
    const key =
      day.getTime() <= today.getTime() ? dayKey(today) : dayKey(day);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets.entries()].map(([day, count]) => {
    const d = new Date(`${day}T00:00:00`);
    return {
      day,
      label: `${d.getDate()} ${d.toLocaleString("en", { month: "short" })}`,
      count,
    };
  });
}

export interface WeekPoint {
  weekStart: string;
  label: string;
  value: number | null;
  total: number;
}

/** Weekly % of reviews rated GOOD/EASY over the last `weeks` weeks. */
export function weeklyRetention(
  reviews: { reviewedAt: Date; rating: string }[],
  today: Date,
  weeks = 12
): WeekPoint[] {
  const points: WeekPoint[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const start = dayPlus(today, -(w + 1) * 7 + 1);
    const end = dayPlus(start, 7);
    const inWeek = reviews.filter(
      (r) => r.reviewedAt >= start && r.reviewedAt < end
    );
    const good = inWeek.filter(
      (r) => r.rating === "GOOD" || r.rating === "EASY"
    ).length;
    const d = start;
    points.push({
      weekStart: dayKey(start),
      label: `${d.getDate()} ${d.toLocaleString("en", { month: "short" })}`,
      value: inWeek.length ? Math.round((good / inWeek.length) * 100) : null,
      total: inWeek.length,
    });
  }
  return points;
}

export interface MaturityPoint {
  day: string;
  label: string;
  learning: number;
  reviewing: number;
  mastered: number;
}

export interface TopicHistory {
  createdAt: Date;
  reviews: { reviewedAt: Date; rating: string; intervalAfter: number }[];
}

/**
 * Replay each topic's review history to reconstruct Learning / Reviewing /
 * Mastered counts at weekly samples. Status rules mirror scheduler.ts:
 * AGAIN resets reps; MASTERED at reps ≥ 6 and interval ≥ 60.
 */
export function maturityTimeline(
  topics: TopicHistory[],
  today: Date,
  weeks = 12
): MaturityPoint[] {
  const samples: Date[] = [];
  for (let w = weeks - 1; w >= 0; w--) samples.push(dayPlus(today, -w * 7));

  return samples.map((sample) => {
    let learning = 0;
    let reviewing = 0;
    let mastered = 0;
    for (const t of topics) {
      if (localDay(t.createdAt) > sample) continue;
      let reps = 0;
      let status: "L" | "R" | "M" = "L";
      for (const r of t.reviews) {
        if (r.reviewedAt > sample) break;
        reps = r.rating === "AGAIN" ? 0 : reps + 1;
        status =
          reps >= 6 && r.intervalAfter >= 60 ? "M" : reps === 0 ? "L" : "R";
      }
      if (status === "L") learning++;
      else if (status === "R") reviewing++;
      else mastered++;
    }
    return {
      day: dayKey(sample),
      label: `${sample.getDate()} ${sample.toLocaleString("en", { month: "short" })}`,
      learning,
      reviewing,
      mastered,
    };
  });
}

export interface CoverageRow {
  subject: string;
  color: string;
  coveredPct: number;
  topics: number;
  daysToExam: number | null;
}

/** % of each subject's topics with ≥3 successful reviews (reps ≥ 3). */
export function subjectCoverage(
  subjects: {
    name: string;
    color: string;
    examDate: Date | null;
    topics: { repetitions: number }[];
  }[],
  today: Date
): CoverageRow[] {
  return subjects
    .filter((s) => s.topics.length > 0)
    .map((s) => ({
      subject: s.name,
      color: s.color,
      topics: s.topics.length,
      coveredPct: Math.round(
        (s.topics.filter((t) => t.repetitions >= 3).length / s.topics.length) *
          100
      ),
      daysToExam: s.examDate
        ? differenceInCalendarDays(localDay(s.examDate), today)
        : null,
    }));
}
