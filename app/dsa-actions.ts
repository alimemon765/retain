"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { dayKey, dayPlus, today } from "@/lib/dates";
import { sm2 } from "@/lib/sm2";
import { balanceReviewDate, statusAfterReview } from "@/lib/scheduler";
import { outcomeToRating } from "@/lib/dsa";
import type { Difficulty, DsaOutcome, Platform } from "@/lib/types";

function revalidateAll() {
  for (const p of ["/", "/log", "/calendar", "/library", "/progress"]) {
    revalidatePath(p);
  }
}

// DECISION: DSA re-solves are load-balanced against other problems' due dates
// only (not topic reviews) — simpler and one query, and the two domains rarely
// pile onto the same day for a single user.
async function problemDueCountsAround(center: Date): Promise<Map<string, number>> {
  const from = dayPlus(center, -1);
  const to = dayPlus(center, 2);
  const problems = await prisma.problem.findMany({
    where: { status: { not: "SUSPENDED" }, nextReview: { gte: from, lt: to } },
    select: { nextReview: true },
  });
  const counts = new Map<string, number>();
  for (const p of problems) {
    const k = dayKey(p.nextReview);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}

export interface NewProblem {
  title: string;
  platform: Platform;
  externalId?: string;
  url?: string;
  difficulty: Difficulty;
  patternIds: string[];
  notes?: string;
  minutesTaken?: number;
  outcome: DsaOutcome;
}

/** Create a problem and record its first attempt, scheduling the first re-solve. */
export async function createProblem(input: NewProblem) {
  const now = today();
  const rating = outcomeToRating(input.outcome);
  // Fresh SM-2 state, advanced by the first attempt's outcome.
  const next = sm2({ easeFactor: 2.5, intervalDays: 0, repetitions: 0 }, rating);

  const counts = await problemDueCountsAround(dayPlus(now, next.intervalDays));
  const nextReview = balanceReviewDate(now, next.intervalDays, counts);

  const problem = await prisma.problem.create({
    data: {
      title: input.title.trim(),
      platform: input.platform,
      externalId: input.externalId?.trim() || null,
      url: input.url?.trim() || null,
      difficulty: input.difficulty,
      notes: input.notes?.trim() || null,
      firstSolved: now,
      easeFactor: next.easeFactor,
      intervalDays: next.intervalDays,
      repetitions: next.repetitions,
      nextReview,
      status: statusAfterReview(next),
      patterns: {
        create: input.patternIds.map((patternId) => ({ patternId })),
      },
      attempts: {
        create: {
          outcome: input.outcome,
          minutesTaken: input.minutesTaken ?? null,
          intervalBefore: 0,
          intervalAfter: next.intervalDays,
        },
      },
    },
  });
  revalidateAll();
  return problem;
}

/** Record a re-solve attempt and reschedule the problem via SM-2. */
export async function submitAttempt(
  problemId: string,
  outcome: DsaOutcome,
  minutesTaken?: number
) {
  const problem = await prisma.problem.findUniqueOrThrow({
    where: { id: problemId },
  });
  const now = today();
  const next = sm2(
    {
      easeFactor: problem.easeFactor,
      intervalDays: problem.intervalDays,
      repetitions: problem.repetitions,
    },
    outcomeToRating(outcome)
  );

  const counts = await problemDueCountsAround(dayPlus(now, next.intervalDays));
  const nextReview = balanceReviewDate(now, next.intervalDays, counts);

  await prisma.$transaction([
    prisma.attempt.create({
      data: {
        problemId,
        outcome,
        minutesTaken: minutesTaken ?? null,
        intervalBefore: problem.intervalDays,
        intervalAfter: next.intervalDays,
      },
    }),
    prisma.problem.update({
      where: { id: problemId },
      data: {
        easeFactor: next.easeFactor,
        intervalDays: next.intervalDays,
        repetitions: next.repetitions,
        nextReview,
        status: statusAfterReview(next),
      },
    }),
  ]);

  revalidateAll();
  return { intervalDays: next.intervalDays };
}

export async function deleteProblem(id: string) {
  await prisma.problem.delete({ where: { id } });
  revalidateAll();
}

export async function updateProblemStatus(id: string, status: string) {
  await prisma.problem.update({ where: { id }, data: { status } });
  revalidateAll();
}
