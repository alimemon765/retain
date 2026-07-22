"use client";

import { useMemo, useState } from "react";
import { addDays, addWeeks, format, isAfter, startOfDay, startOfWeek } from "date-fns";

// Domain colors (validated trio on the dark surface).
const DOMAIN = {
  study: { color: "#3987e5", label: "topic reviews" },
  dsa: { color: "#c98500", label: "DSA attempts" },
  reading: { color: "#199e70", label: "pages read" },
};

export interface DayActivity {
  reviews: number;
  attempts: number;
  pages: number;
}

export function CrossDomainHeatmap({
  activity,
}: {
  activity: Record<string, DayActivity>;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const today = useMemo(() => startOfDay(new Date()), []);

  const weeks = useMemo(() => {
    const firstWeek = startOfWeek(addWeeks(today, -25), { weekStartsOn: 1 });
    return Array.from({ length: 26 }, (_, w) =>
      Array.from({ length: 7 }, (_, d) => addDays(addWeeks(firstWeek, w), d))
    );
  }, [today]);

  const key = (d: Date) => format(d, "yyyy-MM-dd");
  const sel = selected ? activity[selected] : null;

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-edge bg-surface p-3.5">
      <h2 className="text-[11px] font-medium uppercase tracking-wide text-muted">
        All activity — last 6 months
      </h2>
      <div className="flex flex-wrap gap-3">
        {Object.values(DOMAIN).map((d) => (
          <span key={d.label} className="flex items-center gap-1.5 text-[11px] text-muted">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
            {d.label}
          </span>
        ))}
      </div>

      {/* rtl scroller starts at the newest week; ltr restores order inside */}
      <div className="overflow-x-auto" style={{ direction: "rtl" }}>
        <div
          className="flex gap-[3px]"
          style={{ minWidth: "max-content", direction: "ltr" }}
        >
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((d) => {
                const k = key(d);
                const a = activity[k];
                const future = isAfter(d, today);
                return (
                  <button
                    key={k}
                    type="button"
                    aria-label={format(d, "d MMM")}
                    onClick={() => a && setSelected(k)}
                    className="flex h-[13px] w-[13px] flex-col justify-center gap-[1px] overflow-hidden rounded-[2px] p-[1.5px]"
                    style={{
                      backgroundColor: future
                        ? "transparent"
                        : selected === k
                          ? "#3a3a40"
                          : "var(--surface-2)",
                    }}
                  >
                    {a && a.reviews > 0 && (
                      <span className="h-[2.5px] w-full rounded-[1px]" style={{ backgroundColor: DOMAIN.study.color }} />
                    )}
                    {a && a.attempts > 0 && (
                      <span className="h-[2.5px] w-full rounded-[1px]" style={{ backgroundColor: DOMAIN.dsa.color }} />
                    )}
                    {a && a.pages > 0 && (
                      <span className="h-[2.5px] w-full rounded-[1px]" style={{ backgroundColor: DOMAIN.reading.color }} />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {selected && sel && (
        <div className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2.5 text-sm">
          <span className="text-muted">
            {format(new Date(`${selected}T00:00:00`), "EEEE, d MMM")}
          </span>
          <span className="flex flex-wrap justify-end gap-x-3 gap-y-1">
            {sel.reviews > 0 && (
              <span style={{ color: DOMAIN.study.color }}>
                {sel.reviews} {sel.reviews === 1 ? "review" : "reviews"}
              </span>
            )}
            {sel.attempts > 0 && (
              <span style={{ color: DOMAIN.dsa.color }}>
                {sel.attempts} {sel.attempts === 1 ? "attempt" : "attempts"}
              </span>
            )}
            {sel.pages > 0 && (
              <span style={{ color: DOMAIN.reading.color }}>{sel.pages} pages</span>
            )}
          </span>
        </div>
      )}
    </section>
  );
}
