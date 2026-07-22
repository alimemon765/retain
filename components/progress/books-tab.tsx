import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { today } from "@/lib/dates";
import { finishedPerMonth, pagesPerDay } from "@/lib/analytics-books";
import { getBooks } from "@/lib/queries-books";
import { FinishedPerMonthChart, PagesPerDayChart } from "./books-charts";

export async function BooksTab() {
  const now = today();
  const [sessions, books] = await Promise.all([
    prisma.readingSession.findMany({
      select: { bookId: true, date: true, endPage: true },
    }),
    getBooks(),
  ]);

  const thisYear = now.getFullYear();
  const finishedThisYear = books.filter(
    (b) => b.finishedAt && new Date(b.finishedAt).getFullYear() === thisYear
  ).length;
  const abandoned = books.filter((b) => b.status === "ABANDONED").length;
  const highlights = books.reduce((n, b) => n + b.highlights.length, 0);
  const promoted = books.reduce(
    (n, b) => n + b.highlights.filter((h) => h.topicId !== null).length,
    0
  );
  const reading = books.filter((b) => b.status === "READING");

  const tiles = [
    { label: `Finished in ${thisYear}`, value: String(finishedThisYear) },
    { label: "Abandoned", value: String(abandoned) },
    { label: "Highlights", value: String(highlights) },
    { label: "In revision", value: String(promoted) },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-2">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-edge bg-surface p-3.5">
            <p className="text-xl font-semibold">{t.value}</p>
            <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted">
              {t.label}
            </p>
          </div>
        ))}
      </div>

      {reading.length > 0 && (
        <section className="flex flex-col gap-2 rounded-xl border border-edge bg-surface p-3.5">
          <h2 className="text-[11px] font-medium uppercase tracking-wide text-muted">
            Currently reading
          </h2>
          <div className="flex flex-col gap-3">
            {reading.map((b) => {
              const pct =
                b.totalPages && b.totalPages > 0
                  ? Math.min(Math.round((b.currentPage / b.totalPages) * 100), 100)
                  : null;
              return (
                <div key={b.id} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="truncate font-medium">{b.title}</span>
                    <span className="shrink-0 text-muted">
                      {pct !== null ? `${pct}%` : `p.${b.currentPage}`}
                      {b.projectedFinish &&
                        ` · done ~${format(new Date(b.projectedFinish), "d MMM")}`}
                    </span>
                  </div>
                  {pct !== null && (
                    <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <PagesPerDayChart data={pagesPerDay(sessions, now)} />
      <FinishedPerMonthChart
        data={finishedPerMonth(
          books.map((b) => ({ finishedAt: b.finishedAt, category: b.category })),
          now
        )}
      />
    </div>
  );
}
