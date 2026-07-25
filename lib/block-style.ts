import type { BlockKind } from "./types";

// Fixed blocks are muted; work blocks carry the only strong colours on the
// timeline. Work colours are the validated dark-surface categorical set.
export const BLOCK_COLORS: Record<BlockKind, string> = {
  SLEEP: "#4a4a52",
  GET_READY: "#5f5f68",
  TRAVEL: "#6b6b74",
  CLASS: "#8a93a6",
  MEAL: "#6b6b74",
  BREAK: "#3a3a40",
  BUFFER: "#33333a",
  REVISION: "#3987e5",
  DSA: "#c98500",
  READING: "#199e70",
  SKILL: "#9085e9",
  CUSTOM: "#d55181",
};

export const WORK_KIND_LABEL: Record<string, string> = {
  REVISION: "Revision",
  DSA: "DSA",
  READING: "Reading",
  SKILL: "Skill",
  CUSTOM: "Task",
};

export function isWorkKind(kind: string): boolean {
  return ["REVISION", "DSA", "READING", "SKILL", "CUSTOM"].includes(kind);
}

/** Where a work block should deep-link to, filtered to its own payload. */
export function blockHref(block: {
  kind: string;
  topicIds: string[];
  problemIds: string[];
  bookId?: string | null;
  skillId?: string | null;
}): string | null {
  switch (block.kind) {
    case "REVISION":
      return block.topicIds.length ? "/" : null;
    case "DSA":
      return block.problemIds.length ? "/" : "/library?tab=problems";
    case "READING":
      return block.bookId ? "/library?tab=books" : null;
    case "SKILL":
      return block.skillId ? "/library?tab=skills" : null;
    default:
      return null;
  }
}
