import { format } from "date-fns";
import Link from "next/link";
import { getTodayData } from "@/lib/queries";
import { today } from "@/lib/dates";
import { TodayList } from "@/components/today-list";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const { due, banners, reviewedToday, streak } = await getTodayData();
  const now = today();

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold">{format(now, "EEEE")}</h1>
          <p className="text-sm text-muted">{format(now, "d MMMM yyyy")}</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-semibold text-accent">{streak}</p>
          <p className="text-[11px] uppercase tracking-wide text-muted">
            day streak
          </p>
        </div>
      </header>

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

      <TodayList initialTopics={due} reviewedToday={reviewedToday} streak={streak} />

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
