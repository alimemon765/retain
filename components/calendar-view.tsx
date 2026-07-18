"use client";

import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { SubjectChip } from "./chip";

export interface CalendarTopic {
  id: string;
  name: string;
  subjectName: string;
  color: string;
  day: string; // yyyy-MM-dd
  pulledForward: boolean;
}

interface Exam {
  name: string;
  color: string;
  day: string;
}

function key(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function CalendarView({
  topics,
  exams,
}: {
  topics: CalendarTopic[];
  exams: Exam[];
}) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const m = new Map<string, CalendarTopic[]>();
    for (const t of topics) {
      const list = m.get(t.day) ?? [];
      list.push(t);
      m.set(t.day, list);
    }
    return m;
  }, [topics]);

  const examsByDay = useMemo(() => {
    const m = new Map<string, Exam[]>();
    for (const e of exams) {
      const list = m.get(e.day) ?? [];
      list.push(e);
      m.set(e.day, list);
    }
    return m;
  }, [exams]);

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });

  const selectedTopics = selected ? byDay.get(selected) ?? [] : [];
  const selectedExams = selected ? examsByDay.get(selected) ?? [] : [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonth((m) => addMonths(m, -1))}
          className="rounded-lg border border-edge px-3 py-1.5 text-sm text-muted"
        >
          ←
        </button>
        <span className="font-medium">{format(month, "MMMM yyyy")}</span>
        <button
          type="button"
          onClick={() => setMonth((m) => addMonths(m, 1))}
          className="rounded-lg border border-edge px-3 py-1.5 text-sm text-muted"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wide text-muted">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
          <span key={d} className="py-1">
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const k = key(d);
          const count = byDay.get(k)?.length ?? 0;
          const dayExams = examsByDay.get(k) ?? [];
          const inMonth = isSameMonth(d, month);
          return (
            <button
              key={k}
              type="button"
              onClick={() => setSelected(k)}
              className={`relative flex aspect-square flex-col items-center justify-center rounded-lg text-sm ${
                inMonth ? "" : "opacity-30"
              } ${isToday(d) ? "border border-accent" : "border border-transparent"} ${
                selected === k ? "bg-surface-2" : count > 0 ? "bg-surface" : ""
              }`}
            >
              <span className={dayExams.length ? "font-semibold" : ""}>
                {format(d, "d")}
              </span>
              {count > 0 && (
                <span
                  className={`mt-0.5 text-[10px] leading-none ${
                    count >= 10
                      ? "font-semibold text-again"
                      : count >= 5
                        ? "text-accent"
                        : "text-muted"
                  }`}
                >
                  {count}
                </span>
              )}
              {dayExams.length > 0 && (
                <span
                  className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: dayExams[0].color }}
                />
              )}
            </button>
          );
        })}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50"
          onClick={() => setSelected(null)}
        >
          <div
            className="max-h-[70dvh] overflow-y-auto rounded-t-2xl border-t border-edge bg-surface p-4 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-edge" />
            <p className="mb-3 font-medium">
              {format(new Date(`${selected}T00:00:00`), "EEEE, d MMMM")}
            </p>
            {selectedExams.map((e) => (
              <p
                key={e.name}
                className="mb-2 rounded-lg px-3 py-2 text-sm font-medium"
                style={{ backgroundColor: `${e.color}22`, color: e.color }}
              >
                {e.name} exam
              </p>
            ))}
            {selectedTopics.length === 0 && selectedExams.length === 0 && (
              <p className="text-sm text-muted">Nothing scheduled.</p>
            )}
            <div className="flex flex-col gap-2">
              {selectedTopics.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2.5"
                >
                  <span className="text-sm">{t.name}</span>
                  <span className="flex items-center gap-1.5">
                    {t.pulledForward && (
                      <span className="text-[10px] text-accent">exam prep</span>
                    )}
                    <SubjectChip name={t.subjectName} color={t.color} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
