import { describe, expect, it } from "vitest";
import { isQuarterlyReviewDue } from "./skills";

const now = new Date("2026-07-23T00:00:00");
const daysAgo = (n: number) =>
  new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

describe("isQuarterlyReviewDue", () => {
  it("is never due without active skills", () => {
    expect(isQuarterlyReviewDue(null, false, now)).toBe(false);
    expect(isQuarterlyReviewDue(daysAgo(200), false, now)).toBe(false);
  });

  it("is due when skills exist but were never snapshotted", () => {
    expect(isQuarterlyReviewDue(null, true, now)).toBe(true);
  });

  it("is due at 90+ days since the newest snapshot", () => {
    expect(isQuarterlyReviewDue(daysAgo(90), true, now)).toBe(true);
    expect(isQuarterlyReviewDue(daysAgo(120), true, now)).toBe(true);
  });

  it("is not due before 90 days", () => {
    expect(isQuarterlyReviewDue(daysAgo(89), true, now)).toBe(false);
    expect(isQuarterlyReviewDue(daysAgo(1), true, now)).toBe(false);
  });
});
