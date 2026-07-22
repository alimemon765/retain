import { prisma } from "@/lib/db";
import { dayKey, dayPlus, today } from "@/lib/dates";
import {
  CrossDomainHeatmap,
  type DayActivity,
} from "./cross-heatmap";

export async function LandingHeatmap() {
  const since = dayPlus(today(), -185);
  const [reviews, attempts, sessions] = await Promise.all([
    prisma.review.findMany({
      where: { reviewedAt: { gte: since } },
      select: { reviewedAt: true },
    }),
    prisma.attempt.findMany({
      where: { attemptedAt: { gte: since } },
      select: { attemptedAt: true },
    }),
    prisma.readingSession.findMany({
      where: { date: { gte: since } },
      select: { bookId: true, date: true, endPage: true },
    }),
  ]);

  const activity: Record<string, DayActivity> = {};
  const get = (k: string) =>
    (activity[k] ??= { reviews: 0, attempts: 0, pages: 0 });

  for (const r of reviews) get(dayKey(r.reviewedAt)).reviews++;
  for (const a of attempts) get(dayKey(a.attemptedAt)).attempts++;

  // Pages per session are derived within each book (endPage deltas).
  const byBook = new Map<string, { date: Date; endPage: number }[]>();
  for (const s of sessions) {
    const list = byBook.get(s.bookId) ?? [];
    list.push({ date: s.date, endPage: s.endPage });
    byBook.set(s.bookId, list);
  }
  for (const list of byBook.values()) {
    list.sort((a, b) => a.date.getTime() - b.date.getTime());
    let prev = 0;
    for (const s of list) {
      const read = Math.max(s.endPage - prev, 0);
      prev = Math.max(prev, s.endPage);
      if (read > 0) get(dayKey(s.date)).pages += read;
    }
  }

  return <CrossDomainHeatmap activity={activity} />;
}
