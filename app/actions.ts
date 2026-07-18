"use server";

import { revalidatePath } from "next/cache";
import { differenceInCalendarDays } from "date-fns";
import { prisma } from "@/lib/db";
import { dayKey, dayPlus, localDay, today } from "@/lib/dates";
import { sm2 } from "@/lib/sm2";
import {
  applyExamMode,
  balanceReviewDate,
  statusAfterReview,
} from "@/lib/scheduler";
import type { Rating, Source } from "@/lib/types";

function revalidateAll() {
  for (const p of ["/", "/log", "/calendar", "/subjects", "/stats"]) {
    revalidatePath(p);
  }
}

// ---------- Subjects ----------

export async function createSubject(name: string, color: string) {
  const subject = await prisma.subject.create({
    data: { name: name.trim(), color },
  });
  revalidateAll();
  return subject;
}

export async function updateSubject(
  id: string,
  data: { name?: string; color?: string; examDate?: Date | null }
) {
  await prisma.subject.update({ where: { id }, data });
  revalidateAll();
}

export async function deleteSubject(id: string) {
  await prisma.subject.delete({ where: { id } });
  revalidateAll();
}

// ---------- Topics ----------

export interface NewQuestion {
  text: string;
  answer?: string;
}

export async function createTopic(input: {
  subjectId: string;
  name: string;
  notes?: string;
  source: Source;
  dateStudied: string; // yyyy-MM-dd from the form
  questions: NewQuestion[];
}) {
  const studied = localDay(new Date(`${input.dateStudied}T00:00:00`));
  const topic = await prisma.topic.create({
    data: {
      subjectId: input.subjectId,
      name: input.name.trim(),
      notes: input.notes?.trim() || null,
      source: input.source,
      dateStudied: studied,
      nextReview: dayPlus(studied, 1),
      questions: {
        create: input.questions
          .filter((q) => q.text.trim())
          .map((q) => ({ text: q.text.trim(), answer: q.answer?.trim() || null })),
      },
    },
  });
  revalidateAll();
  return topic;
}

export async function updateTopic(
  id: string,
  data: { name?: string; notes?: string | null; status?: string }
) {
  await prisma.topic.update({ where: { id }, data });
  revalidateAll();
}

export async function deleteTopic(id: string) {
  await prisma.topic.delete({ where: { id } });
  revalidateAll();
}

// ---------- Reviews ----------

/** Count topics due per day in a small window around a date (for balancing). */
async function dueCountsAround(center: Date): Promise<Map<string, number>> {
  const from = dayPlus(center, -1);
  const to = dayPlus(center, 2); // exclusive upper bound
  const topics = await prisma.topic.findMany({
    where: {
      status: { not: "SUSPENDED" },
      nextReview: { gte: from, lt: to },
    },
    select: { nextReview: true },
  });
  const counts = new Map<string, number>();
  for (const t of topics) {
    const k = dayKey(t.nextReview);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}

export async function submitReview(topicId: string, rating: Rating) {
  const topic = await prisma.topic.findUniqueOrThrow({
    where: { id: topicId },
    include: { subject: true },
  });

  const now = today();
  const next = sm2(
    {
      easeFactor: topic.easeFactor,
      intervalDays: topic.intervalDays,
      repetitions: topic.repetitions,
    },
    rating
  );

  const candidate = dayPlus(now, next.intervalDays);
  const counts = await dueCountsAround(candidate);
  let nextReview = balanceReviewDate(now, next.intervalDays, counts);

  const exam = applyExamMode(
    now,
    nextReview,
    next.intervalDays,
    topic.subject.examDate
  );
  nextReview = exam.nextReview;

  await prisma.$transaction([
    prisma.review.create({
      data: {
        topicId,
        rating,
        intervalBefore: topic.intervalDays,
        intervalAfter: next.intervalDays,
      },
    }),
    prisma.topic.update({
      where: { id: topicId },
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
  const shownDays = differenceInCalendarDays(nextReview, now);
  return { intervalDays: shownDays, pulledForward: exam.pulledForward };
}
