import { differenceInCalendarDays } from "date-fns";
import { localDay } from "./dates";

// Interleaved practice set builder. Deliberately mixes patterns — the hard
// skill in DSA is recognizing WHICH pattern applies, and blocked practice
// (20 DP problems in a row) removes that step entirely.

export interface PracticeCandidate {
  id: string;
  title: string;
  patterns: string[];
  nextReview: Date;
  /** 0–100 unaided accuracy per pattern, from patternMastery. */
}

export const MAX_PER_PATTERN = 2;

/**
 * Would adding these patterns push any one of them past the cap? Shared with
 * the day planner so a single block interleaves the same way a practice set does.
 */
export function patternCapReached(
  patterns: string[],
  counts: Map<string, number>,
  max: number = MAX_PER_PATTERN
): boolean {
  return patterns.some((p) => (counts.get(p) ?? 0) >= max);
}

export function countPatterns(
  patterns: string[],
  counts: Map<string, number>
): void {
  for (const p of patterns) counts.set(p, (counts.get(p) ?? 0) + 1);
}

export interface PracticeSetInput {
  candidates: PracticeCandidate[];
  /** pattern name → unaided % (lower = weaker). Missing = neutral 50. */
  patternAccuracy: Map<string, number>;
  today: Date;
  size?: number;
  maxPerPattern?: number;
}

/**
 * Pick `size` problems weighted toward (a) weakest patterns by accuracy and
 * (b) overdue re-solves, never taking more than `maxPerPattern` from any
 * single pattern.
 */
export function buildPracticeSet({
  candidates,
  patternAccuracy,
  today,
  size = 5,
  maxPerPattern = 2,
}: PracticeSetInput): PracticeCandidate[] {
  const scored = candidates
    .map((c) => {
      // Weakness: how far below 100% the problem's weakest pattern sits.
      const weakness = Math.max(
        ...c.patterns.map((p) => 100 - (patternAccuracy.get(p) ?? 50)),
        0
      );
      // Overdueness: days past due, capped so it can't drown out weakness.
      const overdue = Math.min(
        Math.max(differenceInCalendarDays(today, localDay(c.nextReview)), 0),
        30
      );
      return { c, score: weakness + overdue * 2 };
    })
    .sort((a, b) => b.score - a.score);

  const picked: PracticeCandidate[] = [];
  const perPattern = new Map<string, number>();

  for (const { c } of scored) {
    if (picked.length >= size) break;
    if (patternCapReached(c.patterns, perPattern, maxPerPattern)) {
      continue; // would over-concentrate a pattern — skip to keep the mix
    }
    picked.push(c);
    countPatterns(c.patterns, perPattern);
  }

  return picked;
}
