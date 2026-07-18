import { describe, expect, it } from "vitest";
import { isMastered, MAX_INTERVAL_DAYS, sm2, type Sm2State } from "./sm2";

const fresh: Sm2State = { easeFactor: 2.5, intervalDays: 0, repetitions: 0 };

describe("sm2", () => {
  it("first three GOOD reviews graduate at 1/3/7 days", () => {
    const r1 = sm2(fresh, "GOOD");
    expect(r1.intervalDays).toBe(1);
    expect(r1.repetitions).toBe(1);

    const r2 = sm2(r1, "GOOD");
    expect(r2.intervalDays).toBe(3);
    expect(r2.repetitions).toBe(2);

    const r3 = sm2(r2, "GOOD");
    expect(r3.intervalDays).toBe(7);
    expect(r3.repetitions).toBe(3);
    expect(r3.easeFactor).toBe(2.5); // GOOD leaves ease unchanged
  });

  it("fourth GOOD review uses interval × ease", () => {
    const state: Sm2State = { easeFactor: 2.5, intervalDays: 7, repetitions: 3 };
    const r = sm2(state, "GOOD");
    expect(r.intervalDays).toBe(Math.round(7 * 2.5)); // 18
    expect(r.repetitions).toBe(4);
  });

  it("AGAIN resets repetitions and interval, drops ease by 0.2", () => {
    const state: Sm2State = { easeFactor: 2.5, intervalDays: 18, repetitions: 4 };
    const r = sm2(state, "AGAIN");
    expect(r.repetitions).toBe(0);
    expect(r.intervalDays).toBe(1);
    expect(r.easeFactor).toBeCloseTo(2.3);
  });

  it("ease factor never drops below 1.3", () => {
    let state: Sm2State = { easeFactor: 1.4, intervalDays: 5, repetitions: 2 };
    state = sm2(state, "AGAIN");
    expect(state.easeFactor).toBe(1.3);
    state = sm2(state, "HARD");
    expect(state.easeFactor).toBe(1.3);
  });

  it("ease factor caps at 3.0 on EASY", () => {
    const state: Sm2State = { easeFactor: 2.95, intervalDays: 10, repetitions: 4 };
    expect(sm2(state, "EASY").easeFactor).toBe(3.0);
  });

  it("HARD grows interval by at least 1 day", () => {
    const short: Sm2State = { easeFactor: 2.5, intervalDays: 1, repetitions: 1 };
    expect(sm2(short, "HARD").intervalDays).toBe(2); // 1×1.2 rounds to 1, floor is prev+1

    const long: Sm2State = { easeFactor: 2.5, intervalDays: 10, repetitions: 3 };
    expect(sm2(long, "HARD").intervalDays).toBe(12);
  });

  it("interval caps at 180 days", () => {
    const state: Sm2State = { easeFactor: 2.8, intervalDays: 150, repetitions: 6 };
    expect(sm2(state, "GOOD").intervalDays).toBe(MAX_INTERVAL_DAYS);
    expect(sm2(state, "EASY").intervalDays).toBe(MAX_INTERVAL_DAYS);
  });

  it("EASY applies 1.3 bonus over GOOD", () => {
    const state: Sm2State = { easeFactor: 2.5, intervalDays: 7, repetitions: 3 };
    expect(sm2(state, "EASY").intervalDays).toBe(Math.round(7 * 2.5 * 1.3)); // 23
  });

  it("mastery requires ≥6 reps and ≥60-day interval", () => {
    expect(isMastered({ easeFactor: 2.5, intervalDays: 60, repetitions: 6 })).toBe(true);
    expect(isMastered({ easeFactor: 2.5, intervalDays: 59, repetitions: 6 })).toBe(false);
    expect(isMastered({ easeFactor: 2.5, intervalDays: 60, repetitions: 5 })).toBe(false);
  });
});
