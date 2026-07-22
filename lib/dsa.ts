import type { DsaOutcome, Difficulty, Rating } from "./types";

// DSA re-solving is retrieval practice, so an attempt's outcome maps onto the
// existing SM-2 ratings — no second scheduling algorithm. lib/sm2.ts stays the
// single source of truth; this file only translates outcome → rating.
const OUTCOME_TO_RATING: Record<DsaOutcome, Rating> = {
  SOLVED_CLEAN: "EASY", // solved unaided, comfortably
  SOLVED_STRUGGLED: "GOOD", // solved unaided but it took real effort
  NEEDED_HINT: "HARD", // needed a nudge
  LOOKED_UP_SOLUTION: "AGAIN", // did not solve — resets to 1 day
};

export function outcomeToRating(outcome: DsaOutcome): Rating {
  return OUTCOME_TO_RATING[outcome];
}

/** Whether the problem was solved without external help. Used by analytics. */
export function isUnaided(outcome: DsaOutcome): boolean {
  return outcome === "SOLVED_CLEAN" || outcome === "SOLVED_STRUGGLED";
}

export const OUTCOME_LABELS: Record<DsaOutcome, string> = {
  SOLVED_CLEAN: "Clean",
  SOLVED_STRUGGLED: "Struggled",
  NEEDED_HINT: "Hint",
  LOOKED_UP_SOLUTION: "Looked up",
};

export const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  EASY: "#6f9e6b",
  MEDIUM: "#d6b25a",
  HARD: "#b3554d",
};
