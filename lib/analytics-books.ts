import { dayKey, dayPlus, localDay } from "./dates";

export interface PagesPoint {
  day: string;
  label: string;
  pages: number;
  avg7: number;
}

/**
 * Pages read per day over the last `days` days, with a 7-day rolling average.
 * Pages per session are derived: endPage − the previous endPage of that book.
 */
export function pagesPerDay(
  sessions: { bookId: string; date: Date; endPage: number }[],
  today: Date,
  days = 90
): PagesPoint[] {
  // Derive pages-read per session within each book's chronological order.
  const byBook = new Map<string, { date: Date; endPage: number }[]>();
  for (const s of sessions) {
    const list = byBook.get(s.bookId) ?? [];
    list.push({ date: s.date, endPage: s.endPage });
    byBook.set(s.bookId, list);
  }
  const perDay = new Map<string, number>();
  for (const list of byBook.values()) {
    list.sort((a, b) => a.date.getTime() - b.date.getTime());
    let prev = 0;
    for (const s of list) {
      const read = Math.max(s.endPage - prev, 0);
      prev = Math.max(prev, s.endPage);
      const k = dayKey(s.date);
      perDay.set(k, (perDay.get(k) ?? 0) + read);
    }
  }

  const points: PagesPoint[] = [];
  const raw: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = dayPlus(today, -i);
    const pages = perDay.get(dayKey(d)) ?? 0;
    raw.push(pages);
    const window = raw.slice(-7);
    points.push({
      day: dayKey(d),
      label: `${d.getDate()} ${d.toLocaleString("en", { month: "short" })}`,
      pages,
      avg7: Math.round((window.reduce((a, b) => a + b, 0) / window.length) * 10) / 10,
    });
  }
  return points;
}

export interface FinishedPoint {
  month: string;
  TECHNICAL: number;
  NONFICTION: number;
  FICTION: number;
}

/** Books finished per month over the last `months` months, by category. */
export function finishedPerMonth(
  books: { finishedAt: Date | null; category: string }[],
  today: Date,
  months = 12
): FinishedPoint[] {
  const points: FinishedPoint[] = [];
  for (let m = months - 1; m >= 0; m--) {
    const start = new Date(today.getFullYear(), today.getMonth() - m, 1);
    const end = new Date(today.getFullYear(), today.getMonth() - m + 1, 1);
    const inMonth = books.filter(
      (b) =>
        b.finishedAt &&
        localDay(b.finishedAt) >= start &&
        localDay(b.finishedAt) < end
    );
    points.push({
      month: start.toLocaleString("en", { month: "short" }),
      TECHNICAL: inMonth.filter((b) => b.category === "TECHNICAL").length,
      NONFICTION: inMonth.filter((b) => b.category === "NONFICTION").length,
      FICTION: inMonth.filter((b) => b.category === "FICTION").length,
    });
  }
  return points;
}
