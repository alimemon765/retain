import { differenceInCalendarDays } from "date-fns";
import { dayKey, dayPlus, localDay } from "./dates";
import type { Sm2State } from "./sm2";
import { isMastered } from "./sm2";
import type { Status } from "./types";

export const MAX_DUE_PER_DAY = 10;

/**
 * Pick the actual review date for a computed interval, shifting ±1 day off
 * overloaded days. `dueCounts` maps dayKey(date) → number of topics already
 * due that day. Never schedules earlier than tomorrow.
 */
export function balanceReviewDate(
  today: Date,
  intervalDays: number,
  dueCounts: Map<string, number>
): Date {
  const base = localDay(today);
  const tomorrow = dayPlus(base, 1);
  const candidate = dayPlus(base, Math.max(intervalDays, 1));

  const count = dueCounts.get(dayKey(candidate)) ?? 0;
  if (count < MAX_DUE_PER_DAY) return candidate;

  const before = dayPlus(candidate, -1);
  const after = dayPlus(candidate, 1);
  const beforeCount = dueCounts.get(dayKey(before)) ?? 0;
  const afterCount = dueCounts.get(dayKey(after)) ?? 0;

  // Prefer the lighter neighboring day; -1 is only allowed from tomorrow on.
  const beforeAllowed = before.getTime() >= tomorrow.getTime();
  if (beforeAllowed && beforeCount <= afterCount) return before;
  return after;
}

/** Status after a review, given the new SM-2 state. */
export function statusAfterReview(state: Sm2State): Status {
  if (isMastered(state)) return "MASTERED";
  return state.repetitions === 0 ? "LEARNING" : "REVIEWING";
}

export interface ExamAdjustment {
  pulledForward: boolean;
  nextReview: Date;
}

/**
 * Exam Mode: if the subject's exam is within 21 days and the scheduled review
 * lands after the exam, pull it forward to max(tomorrow, examDate −
 * intervalDays/2) so the topic is seen at least once before the exam.
 */
export function applyExamMode(
  today: Date,
  nextReview: Date,
  intervalDays: number,
  examDate: Date | null | undefined
): ExamAdjustment {
  const base = localDay(today);
  if (!examDate) return { pulledForward: false, nextReview };

  const exam = localDay(examDate);
  const daysToExam = differenceInCalendarDays(exam, base);
  if (daysToExam < 0 || daysToExam > 21) {
    return { pulledForward: false, nextReview };
  }
  if (localDay(nextReview).getTime() <= exam.getTime()) {
    return { pulledForward: false, nextReview };
  }

  const tomorrow = dayPlus(base, 1);
  const target = dayPlus(exam, -Math.floor(intervalDays / 2));
  const pulled = target.getTime() < tomorrow.getTime() ? tomorrow : target;
  return { pulledForward: true, nextReview: pulled };
}
