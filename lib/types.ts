// SQLite via Prisma does not support native enums, so these unions are the
// source of truth for the string columns in the schema.
export type Rating = "AGAIN" | "HARD" | "GOOD" | "EASY";
export type Source = "COLLEGE" | "SELF";
export type Status = "LEARNING" | "REVIEWING" | "MASTERED" | "SUSPENDED";

export const RATINGS: Rating[] = ["AGAIN", "HARD", "GOOD", "EASY"];

// ---------- Phase 2 unions ----------
export type Platform = "LEETCODE" | "CODEFORCES" | "GFG" | "OTHER";
export type Difficulty = "EASY" | "MEDIUM" | "HARD";
export type DsaOutcome =
  | "SOLVED_CLEAN"
  | "SOLVED_STRUGGLED"
  | "NEEDED_HINT"
  | "LOOKED_UP_SOLUTION";

export const DIFFICULTIES: Difficulty[] = ["EASY", "MEDIUM", "HARD"];
export const PLATFORMS: Platform[] = ["LEETCODE", "CODEFORCES", "GFG", "OTHER"];
export const DSA_OUTCOMES: DsaOutcome[] = [
  "SOLVED_CLEAN",
  "SOLVED_STRUGGLED",
  "NEEDED_HINT",
  "LOOKED_UP_SOLUTION",
];

export type BookCategory = "TECHNICAL" | "NONFICTION" | "FICTION";
export type BookStatus =
  | "WANT_TO_READ"
  | "READING"
  | "FINISHED"
  | "ABANDONED";

export type SkillCategory =
  | "FRONTEND"
  | "BACKEND"
  | "ML"
  | "DEVOPS"
  | "LANGUAGE"
  | "OTHER";
export type EvidenceKind =
  | "PROJECT"
  | "COURSE"
  | "BOOK"
  | "ARTICLE"
  | "PROBLEM_SET";
