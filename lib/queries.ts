import { differenceInCalendarDays } from "date-fns";
import { prisma } from "./db";
import { dayKey, dayPlus, localDay, today } from "./dates";
import { applyExamMode } from "./scheduler";
import type { Rating, Source, Status } from "./types";

// Exam Mode is applied at read time: the DB keeps pure SM-2 dates and
// `effectiveNextReview` is what the UI schedules against. Idempotent, and
// scheduling returns to normal automatically once the exam passes.

export interface TopicWithDue {
  id: string;
  name: string;
  notes: string | null;
  source: Source;
  status: Status;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  dateStudied: Date;
  nextReview: Date;
  effectiveNextReview: Date;
  pulledForward: boolean;
  subject: { id: string; name: string; color: string; examDate: Date | null };
  questions: { id: string; text: string; answer: string | null }[];
}

export async function getActiveTopics(): Promise<TopicWithDue[]> {
  const now = today();
  const topics = await prisma.topic.findMany({
    where: { status: { not: "SUSPENDED" } },
    include: {
      subject: { select: { id: true, name: true, color: true, examDate: true } },
      questions: { select: { id: true, text: true, answer: true } },
    },
    orderBy: { nextReview: "asc" },
  });
  return topics.map((t) => {
    const adj = applyExamMode(
      now,
      localDay(t.nextReview),
      t.intervalDays,
      t.subject.examDate
    );
    return {
      ...t,
      source: t.source as Source,
      status: t.status as Status,
      nextReview: localDay(t.nextReview),
      effectiveNextReview: adj.nextReview,
      pulledForward: adj.pulledForward,
    };
  });
}

export interface ExamBanner {
  subjectId: string;
  subjectName: string;
  color: string;
  daysToExam: number;
  onTrack: number;
  pulledForward: number;
}

export async function getTodayData() {
  const now = today();
  const all = await getActiveTopics();

  const due = all
    .filter((t) => t.effectiveNextReview.getTime() <= now.getTime())
    .sort(
      (a, b) => a.effectiveNextReview.getTime() - b.effectiveNextReview.getTime()
    );

  const banners: ExamBanner[] = [];
  const bySubject = new Map<string, TopicWithDue[]>();
  for (const t of all) {
    const list = bySubject.get(t.subject.id) ?? [];
    list.push(t);
    bySubject.set(t.subject.id, list);
  }
  for (const [subjectId, topics] of bySubject) {
    const { subject } = topics[0];
    if (!subject.examDate) continue;
    const daysToExam = differenceInCalendarDays(localDay(subject.examDate), now);
    if (daysToExam < 0 || daysToExam > 21) continue;
    const pulled = topics.filter((t) => t.pulledForward).length;
    banners.push({
      subjectId,
      subjectName: subject.name,
      color: subject.color,
      daysToExam,
      onTrack: topics.length - pulled,
      pulledForward: pulled,
    });
  }

  const [reviewedToday, streak] = await Promise.all([
    prisma.review.count({ where: { reviewedAt: { gte: now } } }),
    getCurrentStreak(),
  ]);

  return { due, banners, reviewedToday, streak };
}

async function reviewDayKeys(): Promise<Set<string>> {
  const reviews = await prisma.review.findMany({
    select: { reviewedAt: true },
  });
  return new Set(reviews.map((r) => dayKey(r.reviewedAt)));
}

export async function getCurrentStreak(): Promise<number> {
  const days = await reviewDayKeys();
  const now = today();
  // Streak may end today or, if nothing reviewed yet today, yesterday.
  let cursor = days.has(dayKey(now)) ? now : dayPlus(now, -1);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor = dayPlus(cursor, -1);
  }
  return streak;
}

export async function getStatsData() {
  const now = today();
  const reviews = await prisma.review.findMany({
    select: { reviewedAt: true, rating: true, topic: { select: { subjectId: true } } },
    orderBy: { reviewedAt: "asc" },
  });

  // Heatmap: last ~6 months of daily counts.
  const heatStart = dayPlus(now, -182);
  const heatmap = new Map<string, number>();
  for (const r of reviews) {
    if (r.reviewedAt < heatStart) continue;
    const k = dayKey(r.reviewedAt);
    heatmap.set(k, (heatmap.get(k) ?? 0) + 1);
  }

  // Streaks over all distinct review days.
  const days = [...new Set(reviews.map((r) => dayKey(r.reviewedAt)))].sort();
  let longest = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const k of days) {
    const d = localDay(new Date(`${k}T00:00:00`));
    run = prev && differenceInCalendarDays(d, prev) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }

  const last30 = reviews.filter(
    (r) => differenceInCalendarDays(now, r.reviewedAt) < 30
  );
  const good = last30.filter(
    (r) => r.rating === "GOOD" || r.rating === "EASY"
  ).length;
  const retention = last30.length ? Math.round((good / last30.length) * 100) : null;

  // Per-subject breakdown.
  const subjects = await prisma.subject.findMany({
    include: { topics: { select: { status: true } } },
  });
  const reviewsBySubject = new Map<string, number>();
  for (const r of reviews) {
    const id = r.topic.subjectId;
    reviewsBySubject.set(id, (reviewsBySubject.get(id) ?? 0) + 1);
  }
  const perSubject = subjects.map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color,
    topics: s.topics.length,
    mastered: s.topics.filter((t) => t.status === "MASTERED").length,
    reviews: reviewsBySubject.get(s.id) ?? 0,
  }));

  return {
    heatmap: Object.fromEntries(heatmap),
    currentStreak: await getCurrentStreak(),
    longestStreak: longest,
    totalReviews: reviews.length,
    retention,
    perSubject,
  };
}

export async function getSubjectsData() {
  const subjects = await prisma.subject.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      topics: {
        orderBy: { nextReview: "asc" },
        include: { questions: { select: { id: true } } },
      },
    },
  });
  return subjects.map((s) => ({
    ...s,
    examDate: s.examDate ? localDay(s.examDate) : null,
    masteredPct: s.topics.length
      ? Math.round(
          (s.topics.filter((t) => t.status === "MASTERED").length /
            s.topics.length) *
            100
        )
      : 0,
  }));
}
