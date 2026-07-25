import Link from "next/link";
import { addDays, format } from "date-fns";
import { localDay, today } from "@/lib/dates";
import {
  getBlocksForDate,
  getClassSlots,
  getPlannerSettings,
} from "@/lib/queries-planner";
import { DayView } from "@/components/planner/day-view";
import { WeekView } from "@/components/planner/week-view";
import { OverflowStrip } from "@/components/planner/overflow-strip";
import { TasksPanel } from "@/components/planner/tasks-panel";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function isoOf(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export default async function PlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: dateParam } = await searchParams;
  const date = dateParam
    ? localDay(new Date(`${dateParam}T00:00:00`))
    : today();
  const iso = isoOf(date);

  const [blocks, settings, slots, tasks] = await Promise.all([
    getBlocksForDate(date),
    getPlannerSettings(),
    getClassSlots(),
    prisma.manualTask.findMany({
      where: { done: false },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{format(date, "EEEE")}</h1>
          <p className="text-sm text-muted">{format(date, "d MMMM")}</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link
            href={`/planner?date=${isoOf(addDays(date, -1))}`}
            aria-label="Previous day"
            className="rounded-lg border border-edge px-2.5 py-1 text-muted"
          >
            ←
          </Link>
          <Link
            href={`/planner?date=${isoOf(addDays(date, 1))}`}
            aria-label="Next day"
            className="rounded-lg border border-edge px-2.5 py-1 text-muted"
          >
            →
          </Link>
          <Link href="/planner/setup" className="text-accent underline">
            setup
          </Link>
        </div>
      </div>

      <WeekView date={date} />

      <DayView
        dateISO={iso}
        dateLabel={format(date, "EEEE")}
        blocks={blocks}
        focusMode={settings.focusMode}
        hasTimetable={slots.length > 0}
      />

      {blocks.length > 0 && <OverflowStrip dateISO={iso} />}

      <TasksPanel tasks={tasks} />
    </div>
  );
}
