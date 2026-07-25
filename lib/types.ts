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

// ---------- Phase 3 unions ----------
export type FocusMode = "BALANCED" | "EXAMS" | "CP" | "READING" | "SKILLS";
export const FOCUS_MODES: FocusMode[] = [
  "BALANCED",
  "EXAMS",
  "CP",
  "READING",
  "SKILLS",
];

/** Fixed kinds are immovable; work kinds hold candidates; BREAK/BUFFER are slack. */
export type BlockKind =
  | "SLEEP"
  | "GET_READY"
  | "TRAVEL"
  | "CLASS"
  | "MEAL"
  | "REVISION"
  | "DSA"
  | "READING"
  | "SKILL"
  | "CUSTOM"
  | "BREAK"
  | "BUFFER";

export const WORK_KINDS: BlockKind[] = [
  "REVISION",
  "DSA",
  "READING",
  "SKILL",
  "CUSTOM",
];

export type WeekParity = "EVERY" | "ODD" | "EVEN";
export type ExceptionKind = "HOLIDAY" | "NO_COLLEGE" | "CUSTOM_BUSY" | "EXAM";
export type ManualTaskKind = "DSA" | "READING" | "SKILL" | "STUDY" | "ADMIN";
export const MANUAL_TASK_KINDS: ManualTaskKind[] = [
  "DSA",
  "READING",
  "SKILL",
  "STUDY",
  "ADMIN",
];

/** How much focused thought a candidate needs — matched to time-of-day alertness. */
export type Demand = "HIGH" | "MEDIUM" | "LOW";

export interface MealBlock {
  label: string;
  start: string; // HH:mm
  minutes: number;
}
