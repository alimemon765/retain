import { differenceInCalendarDays } from "date-fns";
import { prisma } from "./db";
import { localDay, today } from "./dates";
import { getActiveTopics } from "./queries";
import { getDueProblems } from "./queries-dsa";
import { getReadingNudges } from "./queries-books";
import { getSkills } from "./queries-skills";
import { MINUTES_PER_REVIEW, type Candidate } from "./planner";
import type { ManualTaskKind } from "./types";

// Assembles everything Retain already knows is due into the planner's input.
// Estimates are deliberately coarse — the planner's slack absorbs the error.

const DSA_MINUTES: Record<string, number> = {
  EASY: 20,
  MEDIUM: 35,
  HARD: 50,
};
/** A re-solve is quicker than a first solve — you've seen it before. */
const RESOLVE_FACTOR = 0.7;
const READING_MINUTES = 30;
const SKILL_MINUTES = 60;

const MANUAL_KIND_TO_BLOCK: Record<ManualTaskKind, Candidate["kind"]> = {
  DSA: "DSA",
  READING: "READING",
  SKILL: "SKILL",
  STUDY: "REVISION",
  ADMIN: "CUSTOM",
};

const MANUAL_KIND_TO_DEMAND: Record<ManualTaskKind, Candidate["demand"]> = {
  DSA: "HIGH",
  READING: "LOW",
  SKILL: "HIGH",
  STUDY: "MEDIUM",
  ADMIN: "LOW",
};

export async function gatherCandidates(): Promise<Candidate[]> {
  const now = today();
  const [topics, dueProblems, newProblems, reading, skills, manualTasks] =
    await Promise.all([
      getActiveTopics(),
      getDueProblems(),
      // Problems solved once but never re-solved are still worth revisiting.
      prisma.problem.findMany({
        where: { status: "LEARNING", nextReview: { gt: now } },
        take: 5,
        orderBy: { firstSolved: "desc" },
        include: { patterns: { include: { pattern: { select: { name: true } } } } },
      }),
      getReadingNudges(),
      getSkills(false),
      prisma.manualTask.findMany({
        where: { done: false },
        orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      }),
    ]);

  const candidates: Candidate[] = [];

  // --- SM-2 topic reviews (the spine — planner never drops these) ---
  for (const t of topics) {
    const due = differenceInCalendarDays(now, t.effectiveNextReview);
    if (due < 0) continue;
    const daysToExam = t.subject.examDate
      ? differenceInCalendarDays(localDay(t.subject.examDate), now)
      : null;
    candidates.push({
      id: `topic:${t.id}`,
      source: due > 0 ? "REVIEW_OVERDUE" : "REVIEW_DUE",
      kind: "REVISION",
      title: t.name,
      estimateMins: MINUTES_PER_REVIEW,
      demand: "MEDIUM",
      daysOverdue: due,
      daysToExam,
      topicId: t.id,
    });
  }

  // --- DSA re-solves ---
  for (const p of dueProblems) {
    const due = differenceInCalendarDays(now, p.nextReview);
    candidates.push({
      id: `problem:${p.id}`,
      source: due > 0 ? "DSA_RESOLVE_OVERDUE" : "DSA_RESOLVE_DUE",
      kind: "DSA",
      title: p.title,
      estimateMins: Math.round(
        (DSA_MINUTES[p.difficulty] ?? 35) * RESOLVE_FACTOR
      ),
      // A re-solve is retrieval practice, not fresh problem-solving.
      demand: "MEDIUM",
      daysOverdue: due,
      patterns: p.patterns.map((x) => x.name),
      problemId: p.id,
    });
  }

  // --- Newly-learned problems worth another pass ---
  for (const p of newProblems) {
    candidates.push({
      id: `problem-new:${p.id}`,
      source: "DSA_NEW",
      kind: "DSA",
      title: p.title,
      estimateMins: DSA_MINUTES[p.difficulty] ?? 35,
      demand: "HIGH",
      patterns: p.patterns.map((x) => x.pattern.name),
      problemId: p.id,
    });
  }

  // --- Reading (one block per book in progress) ---
  for (const b of reading) {
    candidates.push({
      id: `book:${b.bookId}`,
      source: "READING",
      kind: "READING",
      title: `Read ${b.title}`,
      estimateMins: READING_MINUTES,
      demand: "LOW",
      bookId: b.bookId,
    });
  }

  // --- Skill next actions (only skills that have one set) ---
  for (const s of skills) {
    if (!s.nextAction) continue;
    candidates.push({
      id: `skill:${s.id}`,
      source: "SKILL_ACTION",
      kind: "SKILL",
      title: `${s.name}: ${s.nextAction}`,
      estimateMins: SKILL_MINUTES,
      demand: "HIGH",
      skillId: s.id,
    });
  }

  // --- Manual tasks ---
  for (const t of manualTasks) {
    const kind = t.kind as ManualTaskKind;
    const overdue = t.dueDate
      ? Math.max(differenceInCalendarDays(now, localDay(t.dueDate)), 0)
      : 0;
    candidates.push({
      id: `task:${t.id}`,
      source: "MANUAL",
      kind: MANUAL_KIND_TO_BLOCK[kind] ?? "CUSTOM",
      title: t.title,
      estimateMins: t.estimateMins,
      demand: MANUAL_KIND_TO_DEMAND[kind] ?? "MEDIUM",
      daysOverdue: overdue,
      priority: t.priority,
      taskId: t.id,
    });
  }

  return candidates;
}

/**
 * Drop candidates that a locked or completed block already covers. Without
 * this, re-optimizing a day duplicates work that is already placed.
 */
export function excludePlaced(
  candidates: Candidate[],
  placed: {
    topicIds: string[];
    problemIds: string[];
    taskIds: string[];
    bookId: string | null;
    skillId: string | null;
  }[]
): Candidate[] {
  const topics = new Set(placed.flatMap((b) => b.topicIds));
  const problems = new Set(placed.flatMap((b) => b.problemIds));
  const tasks = new Set(placed.flatMap((b) => b.taskIds));
  const books = new Set(placed.map((b) => b.bookId).filter(Boolean));
  const skills = new Set(placed.map((b) => b.skillId).filter(Boolean));

  return candidates.filter((c) => {
    if (c.topicId && topics.has(c.topicId)) return false;
    if (c.problemId && problems.has(c.problemId)) return false;
    if (c.taskId && tasks.has(c.taskId)) return false;
    if (c.bookId && books.has(c.bookId)) return false;
    if (c.skillId && skills.has(c.skillId)) return false;
    return true;
  });
}
