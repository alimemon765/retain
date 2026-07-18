import { describe, expect, it } from "vitest";
import { dayKey, dayPlus, localDay } from "./dates";
import { applyExamMode, balanceReviewDate, statusAfterReview } from "./scheduler";

const today = localDay(new Date("2026-07-18T10:00:00"));
const d = (n: number) => dayPlus(today, n);

describe("balanceReviewDate", () => {
  it("keeps the computed date when the day is light", () => {
    const result = balanceReviewDate(today, 3, new Map());
    expect(result.getTime()).toBe(d(3).getTime());
  });

  it("shifts to the lighter neighbor when the day is full", () => {
    const counts = new Map([
      [dayKey(d(3)), 12],
      [dayKey(d(2)), 5],
      [dayKey(d(4)), 8],
    ]);
    const result = balanceReviewDate(today, 3, counts);
    expect(result.getTime()).toBe(d(2).getTime());
  });

  it("prefers the later day when it is lighter", () => {
    const counts = new Map([
      [dayKey(d(3)), 12],
      [dayKey(d(2)), 9],
      [dayKey(d(4)), 2],
    ]);
    const result = balanceReviewDate(today, 3, counts);
    expect(result.getTime()).toBe(d(4).getTime());
  });

  it("never shifts earlier than tomorrow", () => {
    // interval 1 → candidate is tomorrow; shifting back would be today.
    const counts = new Map([[dayKey(d(1)), 15]]);
    const result = balanceReviewDate(today, 1, counts);
    expect(result.getTime()).toBe(d(2).getTime());
  });

  it("treats interval 0 as tomorrow", () => {
    const result = balanceReviewDate(today, 0, new Map());
    expect(result.getTime()).toBe(d(1).getTime());
  });
});

describe("applyExamMode", () => {
  it("does nothing without an exam date", () => {
    const r = applyExamMode(today, d(30), 20, null);
    expect(r.pulledForward).toBe(false);
  });

  it("does nothing when the exam is more than 21 days out", () => {
    const r = applyExamMode(today, d(40), 20, d(30));
    expect(r.pulledForward).toBe(false);
  });

  it("does nothing when the review lands on or before the exam", () => {
    const r = applyExamMode(today, d(10), 10, d(10));
    expect(r.pulledForward).toBe(false);
  });

  it("pulls a post-exam review to examDate − interval/2", () => {
    const r = applyExamMode(today, d(30), 20, d(15));
    expect(r.pulledForward).toBe(true);
    expect(r.nextReview.getTime()).toBe(d(5).getTime()); // 15 − 20/2
  });

  it("never pulls earlier than tomorrow", () => {
    const r = applyExamMode(today, d(30), 28, d(2));
    expect(r.pulledForward).toBe(true);
    expect(r.nextReview.getTime()).toBe(d(1).getTime());
  });

  it("ignores exams already past", () => {
    const r = applyExamMode(today, d(5), 3, d(-1));
    expect(r.pulledForward).toBe(false);
  });
});

describe("statusAfterReview", () => {
  it("maps state to status", () => {
    expect(statusAfterReview({ easeFactor: 2.5, intervalDays: 1, repetitions: 0 })).toBe("LEARNING");
    expect(statusAfterReview({ easeFactor: 2.5, intervalDays: 3, repetitions: 2 })).toBe("REVIEWING");
    expect(statusAfterReview({ easeFactor: 2.8, intervalDays: 90, repetitions: 7 })).toBe("MASTERED");
  });
});
