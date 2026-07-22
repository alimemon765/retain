import { differenceInCalendarDays } from "date-fns";

// The explicit 1–5 rubric shown wherever a level is set, so a "3" in October
// means the same thing it did in July.
export const SKILL_RUBRIC: Record<number, string> = {
  1: "Read about it",
  2: "Followed a tutorial",
  3: "Built something with docs open",
  4: "Build independently, debug confidently",
  5: "Could teach it / make architectural calls",
};

export const REVIEW_INTERVAL_DAYS = 90;

/**
 * The quarterly review is due when the newest snapshot across all active
 * skills is ≥90 days old. Skills exist but no snapshot at all → also due.
 */
export function isQuarterlyReviewDue(
  latestSnapshotAt: Date | null,
  hasActiveSkills: boolean,
  now: Date
): boolean {
  if (!hasActiveSkills) return false;
  if (!latestSnapshotAt) return true;
  return differenceInCalendarDays(now, latestSnapshotAt) >= REVIEW_INTERVAL_DAYS;
}

export const SKILL_CATEGORY_COLORS: Record<string, string> = {
  FRONTEND: "#5aa7d6",
  BACKEND: "#6f9e6b",
  ML: "#c78fd6",
  DEVOPS: "#d6b25a",
  LANGUAGE: "#d65a8a",
  OTHER: "#8a93a6",
};
