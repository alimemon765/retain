import { prisma } from "./db";
import { localDay, today } from "./dates";
import type { Difficulty, Platform, Status } from "./types";

export interface ProblemCard {
  id: string;
  title: string;
  platform: Platform;
  url: string | null;
  difficulty: Difficulty;
  notes: string | null;
  status: Status;
  repetitions: number;
  intervalDays: number;
  nextReview: Date;
  patterns: { id: string; name: string }[];
}

function toCard(p: {
  id: string;
  title: string;
  platform: string;
  url: string | null;
  difficulty: string;
  notes: string | null;
  status: string;
  repetitions: number;
  intervalDays: number;
  nextReview: Date;
  patterns: { pattern: { id: string; name: string } }[];
}): ProblemCard {
  return {
    id: p.id,
    title: p.title,
    platform: p.platform as Platform,
    url: p.url,
    difficulty: p.difficulty as Difficulty,
    notes: p.notes,
    status: p.status as Status,
    repetitions: p.repetitions,
    intervalDays: p.intervalDays,
    nextReview: localDay(p.nextReview),
    patterns: p.patterns.map((pp) => pp.pattern),
  };
}

const patternInclude = {
  patterns: { include: { pattern: { select: { id: true, name: true } } } },
} as const;

export async function getAllPatterns() {
  return prisma.pattern.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

/** Problems due for a re-solve today (or overdue). */
export async function getDueProblems(): Promise<ProblemCard[]> {
  const now = today();
  const problems = await prisma.problem.findMany({
    where: { status: { not: "SUSPENDED" }, nextReview: { lte: now } },
    include: patternInclude,
    orderBy: { nextReview: "asc" },
  });
  return problems.map(toCard);
}

export interface ProblemFilters {
  patternId?: string;
  difficulty?: Difficulty;
  status?: Status;
}

export async function getProblemsForLibrary(
  filters: ProblemFilters = {}
): Promise<ProblemCard[]> {
  const problems = await prisma.problem.findMany({
    where: {
      difficulty: filters.difficulty,
      status: filters.status,
      patterns: filters.patternId
        ? { some: { patternId: filters.patternId } }
        : undefined,
    },
    include: patternInclude,
    orderBy: { nextReview: "asc" },
  });
  return problems.map(toCard);
}
