"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updatePlannerSettings } from "@/app/planner-actions";
import { fromMinutes, toMinutes } from "@/lib/timetable";
import type { PlannerSettingsRow } from "@/lib/queries-planner";
import type { FocusMode, MealBlock } from "@/lib/types";
import { FOCUS_MODES } from "@/lib/types";

const FOCUS_LABEL: Record<FocusMode, string> = {
  BALANCED: "Balanced",
  EXAMS: "Exams",
  CP: "CP / DSA",
  READING: "Reading",
  SKILLS: "Skills",
};

export function PlannerSettingsForm({ settings }: { settings: PlannerSettingsRow }) {
  const router = useRouter();
  const [s, setS] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Bedtime is derived, so the sleep math is visible rather than implied.
  const bedtime = fromMinutes(
    (toMinutes(s.wakeTime) - Math.round(s.sleepHours * 60) + 24 * 60) % (24 * 60)
  );
  const shortSleep = s.sleepHours < 6.5;

  async function save() {
    setSaving(true);
    try {
      await updatePlannerSettings({
        wakeTime: s.wakeTime,
        sleepHours: s.sleepHours,
        preBufferMinutes: s.preBufferMinutes,
        travelMinutes: s.travelMinutes,
        focusMode: s.focusMode,
        minBlockMinutes: s.minBlockMinutes,
        maxBlockMinutes: s.maxBlockMinutes,
        breakMinutes: s.breakMinutes,
        bufferPercent: s.bufferPercent,
        mealBlocks: s.mealBlocks,
      });
      setToast("Saved");
      setTimeout(() => setToast(null), 2000);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const num = (
    label: string,
    key: keyof PlannerSettingsRow,
    suffix: string,
    step = 1,
    min = 0
  ) => (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
        {label}
      </span>
      <span className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          step={step}
          min={min}
          value={String(s[key])}
          onChange={(e) =>
            setS({ ...s, [key]: Number(e.target.value) } as PlannerSettingsRow)
          }
          className="w-20 rounded-lg bg-surface px-3 py-2.5 text-sm outline-none"
        />
        <span className="text-xs text-muted">{suffix}</span>
      </span>
    </label>
  );

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3">
        <h2 className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Sleep & commute
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
              Wake time
            </span>
            <input
              type="time"
              value={s.wakeTime}
              onChange={(e) => setS({ ...s, wakeTime: e.target.value })}
              className="rounded-lg bg-surface px-3 py-2.5 text-sm outline-none"
            />
          </label>
          {num("Sleep", "sleepHours", "hours", 0.5, 4)}
          {num("Get ready", "preBufferMinutes", "min", 5)}
          {num("Travel each way", "travelMinutes", "min", 5)}
        </div>
        <p className={`text-xs ${shortSleep ? "text-again" : "text-muted"}`}>
          Bedtime lands at <span className="font-medium">{bedtime}</span>
          {shortSleep && " — under 6.5h is below what actually works; consider more."}
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Default focus mode
        </h2>
        <div className="flex flex-wrap gap-2">
          {FOCUS_MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setS({ ...s, focusMode: m })}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                s.focusMode === m
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-edge text-muted"
              }`}
            >
              {FOCUS_LABEL[m]}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Work blocks
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {num("Min block", "minBlockMinutes", "min", 5, 10)}
          {num("Max block", "maxBlockMinutes", "min", 5, 15)}
          {num("Break between", "breakMinutes", "min", 5)}
          {num("Slack", "bufferPercent", "% free time", 5)}
        </div>
        <p className="text-xs text-muted">
          Slack is deliberate: tasks routinely overrun, and a plan with zero
          give fails on the first bad day and then gets abandoned.
        </p>
      </section>

      <MealEditor meals={s.mealBlocks} onChange={(mealBlocks) => setS({ ...s, mealBlocks })} />

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="rounded-xl bg-accent py-3.5 font-medium text-background disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save settings"}
      </button>

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-surface-2 px-4 py-2 text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function MealEditor({
  meals,
  onChange,
}: {
  meals: MealBlock[];
  onChange: (m: MealBlock[]) => void;
}) {
  const set = (i: number, patch: Partial<MealBlock>) =>
    onChange(meals.map((m, j) => (j === i ? { ...m, ...patch } : m)));

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Meals
        </h2>
        <button
          type="button"
          onClick={() => onChange([...meals, { label: "Meal", start: "13:00", minutes: 45 }])}
          className="text-[11px] text-accent underline"
        >
          + add
        </button>
      </div>
      {meals.map((m, i) => (
        <div key={i} className="flex items-center gap-2 rounded-lg bg-surface p-2">
          <input
            value={m.label}
            onChange={(e) => set(i, { label: e.target.value })}
            className="min-w-0 flex-1 rounded bg-surface-2 px-2 py-1.5 text-sm outline-none"
          />
          <input
            type="time"
            value={m.start}
            onChange={(e) => set(i, { start: e.target.value })}
            className="rounded bg-surface-2 px-2 py-1.5 text-sm outline-none"
          />
          <input
            type="number"
            min="5"
            step="5"
            value={m.minutes}
            onChange={(e) => set(i, { minutes: Number(e.target.value) })}
            className="w-16 rounded bg-surface-2 px-2 py-1.5 text-sm outline-none"
          />
          <button
            type="button"
            onClick={() => onChange(meals.filter((_, j) => j !== i))}
            className="text-[11px] text-muted"
          >
            ✕
          </button>
        </div>
      ))}
    </section>
  );
}
