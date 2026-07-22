import { format } from "date-fns";
import Link from "next/link";
import { getTodayData } from "@/lib/queries";
import { getDueProblems } from "@/lib/queries-dsa";
import { getReadingNudges } from "@/lib/queries-books";
import { getSkillReviewDue } from "@/lib/queries-skills";
import { prisma } from "@/lib/db";
import { today } from "@/lib/dates";
import { TodayList } from "@/components/today-list";
import { DsaToday } from "@/components/dsa-today";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const now = today();
  const [
    { due, banners, reviewedToday, streak },
    dueProblems,
    attemptsToday,
    reading,
    skillReviewDue,
  ] = await Promise.all([
    getTodayData(),
    getDueProblems(),
    prisma.attempt.count({ where: { attemptedAt: { gte: now } } }),
    getReadingNudges(),
    getSkillReviewDue(),
  ]);
  // "Items reviewed today" spans the unified queue: topic reviews + DSA re-solves.
  const reviewedTotal = reviewedToday + attemptsToday;
  const nothingDue = due.length === 0 && dueProblems.length === 0;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            {format(now, "EEEE")}{" "}
            <Link href="/settings" aria-label="Settings" className="text-sm text-muted">
              ⚙
            </Link>
          </h1>
          <p className="text-sm text-muted">{format(now, "d MMMM yyyy")}</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-semibold text-accent">{streak}</p>
          <p className="text-[11px] uppercase tracking-wide text-muted">
            day streak
          </p>
        </div>
      </header>

      {skillReviewDue && (
        <Link
          href="/skills-review"
          className="rounded-lg border border-edge bg-surface px-4 py-3 text-sm"
          style={{ borderLeft: "3px solid var(--accent)" }}
        >
          <span className="font-medium text-accent">Quarterly skill review</span>{" "}
          is due — takes 5 minutes. →
        </Link>
      )}

      {banners.map((b) => (
        <div
          key={b.subjectId}
          className="rounded-lg border border-edge bg-surface px-4 py-3 text-sm"
          style={{ borderLeft: `3px solid ${b.color}` }}
        >
          <span className="font-medium">{b.subjectName}</span> exam in{" "}
          {b.daysToExam} {b.daysToExam === 1 ? "day" : "days"} — {b.onTrack}{" "}
          topics on track
          {b.pulledForward > 0 && <>, {b.pulledForward} pulled forward</>}
        </div>
      ))}

      {nothingDue ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-edge bg-surface px-6 py-12 text-center">
          <p className="text-lg font-medium">All clear.</p>
          <p className="text-sm text-muted">
            {reviewedTotal} {reviewedTotal === 1 ? "item" : "items"} reviewed today.
          </p>
          <p className="text-sm text-accent">{streak}-day streak</p>
        </div>
      ) : (
        <>
          {due.length > 0 && (
            <TodayList
              initialTopics={due}
              reviewedToday={reviewedToday}
              streak={streak}
              soleSection={dueProblems.length === 0}
            />
          )}
          <DsaToday initialProblems={dueProblems} />
        </>
      )}

      {/* Passive reading nudge — one line, no guilt copy, no streak pressure. */}
      {reading.length > 0 && (
        <p className="text-sm text-muted">
          Currently reading:{" "}
          {reading.map((r, i) => (
            <span key={r.bookId}>
              {i > 0 && " · "}
              <span className="text-foreground">{r.title}</span>
              {" — page "}
              {r.currentPage}
              {r.totalPages ? `/${r.totalPages}` : ""}
            </span>
          ))}
        </p>
      )}

      <Link
        href="/log"
        aria-label="Log a topic"
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-2xl font-light text-background shadow-lg"
      >
        +
      </Link>
    </div>
  );
}
