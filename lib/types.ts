// SQLite via Prisma does not support native enums, so these unions are the
// source of truth for the string columns in the schema.
export type Rating = "AGAIN" | "HARD" | "GOOD" | "EASY";
export type Source = "COLLEGE" | "SELF";
export type Status = "LEARNING" | "REVIEWING" | "MASTERED" | "SUSPENDED";

export const RATINGS: Rating[] = ["AGAIN", "HARD", "GOOD", "EASY"];
