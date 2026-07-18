import type { Rating } from "./types";

export interface Sm2State {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
}

export const MAX_INTERVAL_DAYS = 180;
const MIN_EASE = 1.3;
const MAX_EASE = 3.0;

// Graduated intervals for the first three successful reviews.
const GRADUATION: Record<number, number> = { 0: 1, 1: 3, 2: 7 };

function goodInterval(state: Sm2State): number {
  const grad = GRADUATION[state.repetitions];
  if (grad !== undefined) return grad;
  return Math.round(state.intervalDays * state.easeFactor);
}

export function sm2(state: Sm2State, rating: Rating): Sm2State {
  let easeFactor = state.easeFactor;
  let intervalDays: number;
  let repetitions: number;

  switch (rating) {
    case "AGAIN":
      repetitions = 0;
      intervalDays = 1;
      easeFactor = Math.max(MIN_EASE, easeFactor - 0.2);
      break;
    case "HARD":
      intervalDays = Math.max(
        Math.round(state.intervalDays * 1.2),
        state.intervalDays + 1
      );
      easeFactor = Math.max(MIN_EASE, easeFactor - 0.15);
      repetitions = state.repetitions + 1;
      break;
    case "GOOD":
      intervalDays = goodInterval(state);
      repetitions = state.repetitions + 1;
      break;
    case "EASY":
      // DECISION: for early repetitions the "easy bonus" applies to the
      // graduated interval (1/3/7 × 1.3); for mature cards it is
      // interval × ease × 1.3, matching Anki's easy bonus.
      intervalDays = Math.round(goodInterval(state) * 1.3);
      easeFactor = Math.min(MAX_EASE, easeFactor + 0.15);
      repetitions = state.repetitions + 1;
      break;
  }

  intervalDays = Math.min(Math.max(intervalDays, 1), MAX_INTERVAL_DAYS);

  return { easeFactor, intervalDays, repetitions };
}

/** A topic is MASTERED at ≥6 consecutive successes with a ≥60-day interval. */
export function isMastered(state: Sm2State): boolean {
  return state.repetitions >= 6 && state.intervalDays >= 60;
}
