"use client";

import { SKILL_RUBRIC } from "@/lib/skills";

/** Rubric-driven 1–5 level picker — the rubric text is always visible. */
export function LevelPicker({
  value,
  onChange,
  accent = "var(--accent)",
}: {
  value: number | null;
  onChange: (level: number) => void;
  accent?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm ${
            value === n ? "border-transparent" : "border-edge text-muted"
          }`}
          style={
            value === n
              ? { backgroundColor: `${accent}1f`, color: accent }
              : undefined
          }
        >
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
              value === n ? "" : "bg-surface-2"
            }`}
            style={value === n ? { backgroundColor: accent, color: "var(--background)" } : undefined}
          >
            {n}
          </span>
          {SKILL_RUBRIC[n]}
        </button>
      ))}
    </div>
  );
}
