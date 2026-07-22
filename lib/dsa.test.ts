import { describe, expect, it } from "vitest";
import { isUnaided, outcomeToRating } from "./dsa";
import { sm2, type Sm2State } from "./sm2";
import type { DsaOutcome } from "./types";

describe("outcomeToRating", () => {
  it("maps each outcome to the correct SM-2 rating", () => {
    expect(outcomeToRating("SOLVED_CLEAN")).toBe("EASY");
    expect(outcomeToRating("SOLVED_STRUGGLED")).toBe("GOOD");
    expect(outcomeToRating("NEEDED_HINT")).toBe("HARD");
    expect(outcomeToRating("LOOKED_UP_SOLUTION")).toBe("AGAIN");
  });

  it("looking up the solution resets via SM-2 (AGAIN → 1 day, reps 0)", () => {
    const state: Sm2State = { easeFactor: 2.5, intervalDays: 30, repetitions: 4 };
    const next = sm2(state, outcomeToRating("LOOKED_UP_SOLUTION"));
    expect(next.intervalDays).toBe(1);
    expect(next.repetitions).toBe(0);
  });

  it("a clean solve schedules further out than a struggle", () => {
    const state: Sm2State = { easeFactor: 2.5, intervalDays: 7, repetitions: 3 };
    const clean = sm2(state, outcomeToRating("SOLVED_CLEAN"));
    const struggled = sm2(state, outcomeToRating("SOLVED_STRUGGLED"));
    expect(clean.intervalDays).toBeGreaterThan(struggled.intervalDays);
  });
});

describe("isUnaided", () => {
  it("is true only for clean/struggled solves", () => {
    const expected: Record<DsaOutcome, boolean> = {
      SOLVED_CLEAN: true,
      SOLVED_STRUGGLED: true,
      NEEDED_HINT: false,
      LOOKED_UP_SOLUTION: false,
    };
    for (const [outcome, want] of Object.entries(expected)) {
      expect(isUnaided(outcome as DsaOutcome)).toBe(want);
    }
  });
});
