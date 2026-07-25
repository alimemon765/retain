"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearDay,
  createClassSlot,
  deleteClassSlot,
  duplicateDay,
  importTimetable,
} from "@/app/planner-actions";
import { dayName, parseTimetable, type ParseResult } from "@/lib/timetable";
import type { ClassSlotRow } from "@/lib/queries-planner";

const DAYS = [1, 2, 3, 4, 5, 6, 0]; // Mon-first

type Mode = "list" | "paste" | "add";

export function TimetableEditor({ slots }: { slots: ClassSlotRow[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(slots.length === 0 ? "paste" : "list");

  const byDay = new Map<number, ClassSlotRow[]>();
  for (const s of slots) {
    const list = byDay.get(s.dayOfWeek) ?? [];
    list.push(s);
    byDay.set(s.dayOfWeek, list);
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Weekly timetable ({slots.length} classes)
        </h2>
        <div className="flex gap-2 text-[11px]">
          {(["list", "paste", "add"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={mode === m ? "text-accent underline" : "text-muted underline"}
            >
              {m === "list" ? "list" : m === "paste" ? "bulk paste" : "add one"}
            </button>
          ))}
        </div>
      </div>

      {mode === "paste" && <BulkPaste onDone={() => { setMode("list"); router.refresh(); }} />}
      {mode === "add" && <AddSlot onDone={() => { setMode("list"); router.refresh(); }} />}

      {mode === "list" && (
        <div className="flex flex-col gap-2">
          {slots.length === 0 && (
            <p className="rounded-xl border border-dashed border-edge bg-surface px-4 py-8 text-center text-sm text-muted">
              No classes yet. Bulk paste is the fastest way in.
            </p>
          )}
          {DAYS.filter((d) => byDay.has(d)).map((d) => (
            <DayRow
              key={d}
              day={d}
              slots={byDay.get(d) ?? []}
              refresh={() => router.refresh()}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function DayRow({
  day,
  slots,
  refresh,
}: {
  day: number;
  slots: ClassSlotRow[];
  refresh: () => void;
}) {
  const [copyTo, setCopyTo] = useState("");

  async function doCopy(value: string) {
    if (!value) return;
    await duplicateDay(day, Number(value));
    setCopyTo("");
    refresh();
  }

  return (
    <div className="rounded-xl border border-edge bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">{dayName(day)}</span>
        <span className="flex items-center gap-2 text-[11px]">
          <select
            value={copyTo}
            onChange={(e) => doCopy(e.target.value)}
            className="rounded bg-surface-2 px-2 py-1 text-[11px] text-muted outline-none"
          >
            <option value="">copy to…</option>
            {DAYS.filter((d) => d !== day).map((d) => (
              <option key={d} value={d}>
                {dayName(d)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={async () => {
              if (confirm(`Clear all ${dayName(day)} classes?`)) {
                await clearDay(day);
                refresh();
              }
            }}
            className="text-again underline"
          >
            clear
          </button>
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {slots.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm"
          >
            <span className="min-w-0">
              <span className="font-mono text-xs text-muted">
                {s.startTime}–{s.endTime}
              </span>{" "}
              <span className="truncate">{s.label}</span>
              {s.location && (
                <span className="ml-1 text-[11px] text-muted">@ {s.location}</span>
              )}
              {s.weekParity !== "EVERY" && (
                <span className="ml-1 rounded bg-background px-1.5 py-0.5 text-[10px] text-accent">
                  {s.weekParity.toLowerCase()} wks
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={async () => {
                await deleteClassSlot(s.id);
                refresh();
              }}
              className="shrink-0 text-[11px] text-muted underline"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

const SAMPLE = `Mon 09:00-10:00 DAA Lecture
Mon 10:00-11:00 FLAT
Tue 11:00-13:00 IT Lab @ Room 204
Wed 2pm-3:30pm DMM (odd weeks)`;

function BulkPaste({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState("");
  const [replaceAll, setReplaceAll] = useState(true);
  const [saving, setSaving] = useState(false);

  // Live preview — parse in the browser before committing anything.
  const preview: ParseResult = parseTimetable(text);

  async function commit() {
    if (preview.slots.length === 0 || saving) return;
    setSaving(true);
    try {
      await importTimetable(text, replaceAll);
      setText("");
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-edge bg-surface p-3">
      <p className="text-xs text-muted">
        One class per line: <span className="font-mono">Day start-end name</span>.
        Flexible about format — <span className="font-mono">9-10.30</span>,{" "}
        <span className="font-mono">2pm-3:30pm</span>, <span className="font-mono">@ Room</span>,{" "}
        <span className="font-mono">(odd weeks)</span> all work.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={7}
        placeholder={SAMPLE}
        spellCheck={false}
        className="rounded-lg bg-surface-2 px-3 py-2.5 font-mono text-xs outline-none placeholder:text-muted"
      />

      {text.trim() && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] uppercase tracking-wide text-muted">
            Preview — {preview.slots.length} ok
            {preview.errors.length > 0 && `, ${preview.errors.length} problem${preview.errors.length === 1 ? "" : "s"}`}
          </p>
          {preview.slots.length > 0 && (
            <div className="max-h-44 overflow-y-auto rounded-lg bg-surface-2">
              <table className="w-full text-xs">
                <tbody>
                  {preview.slots.map((s, i) => (
                    <tr key={i} className="border-b border-edge last:border-0">
                      <td className="px-2 py-1.5 text-muted">{dayName(s.dayOfWeek)}</td>
                      <td className="px-2 py-1.5 font-mono text-muted">
                        {s.startTime}–{s.endTime}
                      </td>
                      <td className="px-2 py-1.5">{s.label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {preview.errors.map((e) => (
            <p key={e.line} className="text-[11px] text-again">
              line {e.line}: {e.reason} — <span className="font-mono">{e.text}</span>
            </p>
          ))}
        </div>
      )}

      <label className="flex items-center gap-2 text-xs text-muted">
        <input
          type="checkbox"
          checked={replaceAll}
          onChange={(e) => setReplaceAll(e.target.checked)}
          className="accent-[color:var(--accent)]"
        />
        Replace the existing timetable (uncheck to append)
      </label>

      <button
        type="button"
        onClick={commit}
        disabled={preview.slots.length === 0 || saving}
        className="rounded-xl bg-accent py-3 font-medium text-background disabled:opacity-50"
      >
        {saving ? "Importing…" : `Import ${preview.slots.length} classes`}
      </button>
    </div>
  );
}

function AddSlot({ onDone }: { onDone: () => void }) {
  const [day, setDay] = useState(1);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [label, setLabel] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!label.trim() || saving) return;
    setSaving(true);
    try {
      await createClassSlot({
        dayOfWeek: day,
        startTime: start,
        endTime: end,
        label,
        location: location || undefined,
      });
      setLabel("");
      setLocation("");
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-edge bg-surface p-3">
      <div className="flex gap-2">
        <select
          value={day}
          onChange={(e) => setDay(Number(e.target.value))}
          className="rounded-lg bg-surface-2 px-2 py-2 text-sm outline-none"
        >
          {DAYS.map((d) => (
            <option key={d} value={d}>
              {dayName(d)}
            </option>
          ))}
        </select>
        <input
          type="time"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="flex-1 rounded-lg bg-surface-2 px-2 py-2 text-sm outline-none"
        />
        <input
          type="time"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className="flex-1 rounded-lg bg-surface-2 px-2 py-2 text-sm outline-none"
        />
      </div>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Class name"
        className="rounded-lg bg-surface-2 px-3 py-2.5 text-sm outline-none placeholder:text-muted"
      />
      <input
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder="Location (optional)"
        className="rounded-lg bg-surface-2 px-3 py-2.5 text-sm outline-none placeholder:text-muted"
      />
      <button
        type="button"
        onClick={save}
        disabled={!label.trim() || saving}
        className="self-start rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        Add class
      </button>
    </div>
  );
}
