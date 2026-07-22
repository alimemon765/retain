import { dayKey, dayPlus, localDay } from "./dates";
import { isUnaided } from "./dsa";
import type { Difficulty, DsaOutcome } from "./types";

export interface PatternMasteryRow {
  pattern: string;
  attempts: number;
  unaidedPct: number;
}

/** Per-pattern attempt counts and % solved unaided, sorted worst-first. */
export function patternMastery(
  attempts: { outcome: string; patterns: string[] }[]
): PatternMasteryRow[] {
  const byPattern = new Map<string, { total: number; unaided: number }>();
  for (const a of attempts) {
    for (const p of a.patterns) {
      const row = byPattern.get(p) ?? { total: 0, unaided: 0 };
      row.total++;
      if (isUnaided(a.outcome as DsaOutcome)) row.unaided++;
      byPattern.set(p, row);
    }
  }
  return [...byPattern.entries()]
    .map(([pattern, { total, unaided }]) => ({
      pattern,
      attempts: total,
      unaidedPct: Math.round((unaided / total) * 100),
    }))
    .sort((a, b) => a.unaidedPct - b.unaidedPct || b.attempts - a.attempts);
}

export interface SolvedPoint {
  day: string;
  label: string;
  EASY: number;
  MEDIUM: number;
  HARD: number;
}

/** Weekly cumulative count of problems first solved, split by difficulty. */
export function solvedOverTime(
  problems: { firstSolved: Date; difficulty: string }[],
  today: Date,
  weeks = 12
): SolvedPoint[] {
  const points: SolvedPoint[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const sample = dayPlus(today, -w * 7);
    const upTo = problems.filter((p) => localDay(p.firstSolved) <= sample);
    points.push({
      day: dayKey(sample),
      label: `${sample.getDate()} ${sample.toLocaleString("en", { month: "short" })}`,
      EASY: upTo.filter((p) => p.difficulty === "EASY").length,
      MEDIUM: upTo.filter((p) => p.difficulty === "MEDIUM").length,
      HARD: upTo.filter((p) => p.difficulty === "HARD").length,
    });
  }
  return points;
}

export interface MedianPoint {
  month: string;
  EASY: number | null;
  MEDIUM: number | null;
  HARD: number | null;
}

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/** Monthly median minutes-to-solve per difficulty (last `months` months). */
export function timeToSolveTrend(
  attempts: { attemptedAt: Date; minutesTaken: number | null; difficulty: string }[],
  today: Date,
  months = 6
): MedianPoint[] {
  const points: MedianPoint[] = [];
  for (let m = months - 1; m >= 0; m--) {
    const d = new Date(today.getFullYear(), today.getMonth() - m, 1);
    const next = new Date(today.getFullYear(), today.getMonth() - m + 1, 1);
    const inMonth = attempts.filter(
      (a) => a.minutesTaken !== null && a.attemptedAt >= d && a.attemptedAt < next
    );
    const by = (diff: Difficulty) =>
      median(
        inMonth
          .filter((a) => a.difficulty === diff)
          .map((a) => a.minutesTaken as number)
      );
    points.push({
      month: d.toLocaleString("en", { month: "short" }),
      EASY: by("EASY"),
      MEDIUM: by("MEDIUM"),
      HARD: by("HARD"),
    });
  }
  return points;
}

export interface RatePoint {
  weekStart: string;
  label: string;
  value: number | null;
}

/** Weekly % of attempts solved unaided. */
export function unaidedRate(
  attempts: { attemptedAt: Date; outcome: string }[],
  today: Date,
  weeks = 12
): RatePoint[] {
  const points: RatePoint[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const start = dayPlus(today, -(w + 1) * 7 + 1);
    const end = dayPlus(start, 7);
    const inWeek = attempts.filter(
      (a) => a.attemptedAt >= start && a.attemptedAt < end
    );
    const unaided = inWeek.filter((a) => isUnaided(a.outcome as DsaOutcome)).length;
    points.push({
      weekStart: dayKey(start),
      label: `${start.getDate()} ${start.toLocaleString("en", { month: "short" })}`,
      value: inWeek.length ? Math.round((unaided / inWeek.length) * 100) : null,
    });
  }
  return points;
}
