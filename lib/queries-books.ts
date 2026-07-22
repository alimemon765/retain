import { differenceInCalendarDays } from "date-fns";
import { prisma } from "./db";
import { dayPlus, localDay, today } from "./dates";
import type { BookCategory, BookStatus } from "./types";

export interface BookRow {
  id: string;
  title: string;
  author: string;
  category: BookCategory;
  totalPages: number | null;
  status: BookStatus;
  startedAt: Date | null;
  finishedAt: Date | null;
  rating: number | null;
  currentPage: number;
  /** Average pages/day over the last 14 days; null without enough data. */
  recentRate: number | null;
  projectedFinish: Date | null;
  highlights: {
    id: string;
    page: number | null;
    text: string;
    note: string | null;
    topicId: string | null;
  }[];
  sessionCount: number;
}

export async function getBooks(): Promise<BookRow[]> {
  const now = today();
  const books = await prisma.book.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      sessions: { orderBy: { date: "asc" } },
      highlights: {
        orderBy: { page: "asc" },
        select: { id: true, page: true, text: true, note: true, topicId: true },
      },
    },
  });

  return books.map((b) => {
    const currentPage = b.sessions.length
      ? Math.max(...b.sessions.map((s) => s.endPage))
      : 0;

    // Recent rate: pages covered in the last 14 days ÷ 14.
    const cutoff = dayPlus(now, -14);
    const recent = b.sessions.filter((s) => localDay(s.date) >= cutoff);
    let recentRate: number | null = null;
    if (recent.length > 0) {
      const before = b.sessions.filter((s) => localDay(s.date) < cutoff);
      const startPage = before.length
        ? Math.max(...before.map((s) => s.endPage))
        : 0;
      const pages = currentPage - startPage;
      if (pages > 0) recentRate = pages / 14;
    }

    let projectedFinish: Date | null = null;
    if (
      b.status === "READING" &&
      b.totalPages !== null &&
      recentRate !== null &&
      currentPage < b.totalPages
    ) {
      const daysLeft = Math.ceil((b.totalPages - currentPage) / recentRate);
      projectedFinish = dayPlus(now, daysLeft);
    }

    return {
      id: b.id,
      title: b.title,
      author: b.author,
      category: b.category as BookCategory,
      totalPages: b.totalPages,
      status: b.status as BookStatus,
      startedAt: b.startedAt,
      finishedAt: b.finishedAt,
      rating: b.rating,
      currentPage,
      recentRate,
      projectedFinish,
      highlights: b.highlights,
      sessionCount: b.sessions.length,
    };
  });
}

export interface ReadingNudge {
  bookId: string;
  title: string;
  currentPage: number;
  totalPages: number | null;
}

/** Passive one-liner for Today: the book(s) currently being read. */
export async function getReadingNudges(): Promise<ReadingNudge[]> {
  const books = await prisma.book.findMany({
    where: { status: "READING" },
    orderBy: { createdAt: "desc" },
    include: { sessions: { select: { endPage: true } } },
  });
  return books.map((b) => ({
    bookId: b.id,
    title: b.title,
    currentPage: b.sessions.length
      ? Math.max(...b.sessions.map((s) => s.endPage))
      : 0,
    totalPages: b.totalPages,
  }));
}

export function daysToFinish(projected: Date | null): number | null {
  if (!projected) return null;
  return differenceInCalendarDays(projected, today());
}
