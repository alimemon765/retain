import Link from "next/link";
import { addDays, format, startOfWeek } from "date-fns";
import { dayKey } from "@/lib/dates";
import { getWeekSummary } from "@/lib/queries-planner";
import { BLOCK_COLORS } from "@/lib/block-style";
import type { BlockKind } from "@/lib/types";

const WORK_KINDS: BlockKind[] = ["REVISION", "DSA", "READING", "SKILL", "CUSTOM"];

/** Seven compressed columns — for spotting empty days and overloaded ones. */
export async function WeekView({ date }: { date: Date }) {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const summary = await getWeekSummary(days[0], days[6]);

  const maxWork = Math.max(
    1,
    ...days.map((d) => {
      const s = summary.get(dayKey(d));
      if (!s) return 0;
      return WORK_KINDS.reduce((n, k) => n + (s.minutesByKind[k] ?? 0), 0);
    })
  );

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[11px] font-medium uppercase tracking-wide text-muted">
        This week
      </h2>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const iso = dayKey(d);
          const s = summary.get(iso);
          const isSame = iso === dayKey(date);
          const segments = WORK_KINDS.map((k) => ({
            kind: k,
            mins: s?.minutesByKind[k] ?? 0,
          })).filter((x) => x.mins > 0);
          const total = segments.reduce((n, x) => n + x.mins, 0);

          return (
            <Link
              key={iso}
              href={`/planner?date=${iso}`}
              className={`flex flex-col items-center gap-1 rounded-lg py-1.5 ${
                isSame ? "bg-surface-2" : ""
              }`}
            >
              <span className="text-[10px] uppercase text-muted">
                {format(d, "EEEEE")}
              </span>
              <span className={`text-xs ${isSame ? "text-accent" : ""}`}>
                {format(d, "d")}
              </span>
              {/* Stacked bar: height is total work, colours are categories. */}
              <span className="flex h-14 w-3 flex-col-reverse justify-start overflow-hidden rounded-full bg-surface">
                {segments.map((seg) => (
                  <span
                    key={seg.kind}
                    style={{
                      height: `${(seg.mins / maxWork) * 100}%`,
                      backgroundColor: BLOCK_COLORS[seg.kind],
                    }}
                  />
                ))}
              </span>
              <span className="text-[9px] text-muted">
                {total > 0 ? `${Math.round(total / 6) / 10}h` : "—"}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
