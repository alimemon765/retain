"use client";

import { useState } from "react";
import { createProblem } from "@/app/dsa-actions";
import { DIFFICULTY_COLORS, OUTCOME_LABELS } from "@/lib/dsa";
import {
  DIFFICULTIES,
  DSA_OUTCOMES,
  PLATFORMS,
  type Difficulty,
  type DsaOutcome,
  type Platform,
} from "@/lib/types";

interface PatternOption {
  id: string;
  name: string;
}

export function ProblemForm({ patterns }: { patterns: PatternOption[] }) {
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState<Platform>("LEETCODE");
  const [url, setUrl] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("MEDIUM");
  const [selectedPatterns, setSelectedPatterns] = useState<Set<string>>(new Set());
  const [minutes, setMinutes] = useState("");
  const [outcome, setOutcome] = useState<DsaOutcome>("SOLVED_STRUGGLED");
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function togglePattern(id: string) {
    setSelectedPatterns((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await createProblem({
        title,
        platform,
        url: url || undefined,
        difficulty,
        patternIds: [...selectedPatterns],
        minutesTaken: minutes ? Number(minutes) : undefined,
        outcome,
        notes: notes || undefined,
      });
      setTitle("");
      setUrl("");
      setSelectedPatterns(new Set());
      setMinutes("");
      setNotes("");
      setToast("Logged — re-solve scheduled");
      setTimeout(() => setToast(null), 2500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <label
          htmlFor="problem-title"
          className="text-[11px] font-medium uppercase tracking-wide text-muted"
        >
          Problem
        </label>
        <input
          id="problem-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Longest Substring Without Repeating Characters"
          required
          className="rounded-lg bg-surface px-3 py-3 outline-none placeholder:text-muted"
        />
      </fieldset>

      <div className="flex gap-3">
        <fieldset className="flex flex-1 flex-col gap-2">
          <label className="text-[11px] font-medium uppercase tracking-wide text-muted">
            Platform
          </label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as Platform)}
            className="rounded-lg bg-surface px-3 py-2.5 text-sm outline-none"
          >
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p.charAt(0) + p.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </fieldset>
        <fieldset className="flex flex-1 flex-col gap-2">
          <label className="text-[11px] font-medium uppercase tracking-wide text-muted">
            Difficulty
          </label>
          <div className="flex overflow-hidden rounded-lg border border-edge">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDifficulty(d)}
                className="flex-1 py-2.5 text-xs font-medium"
                style={
                  difficulty === d
                    ? { backgroundColor: `${DIFFICULTY_COLORS[d]}26`, color: DIFFICULTY_COLORS[d] }
                    : { color: "var(--muted)" }
                }
              >
                {d.charAt(0) + d.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <fieldset className="flex flex-col gap-2">
        <label
          htmlFor="problem-url"
          className="text-[11px] font-medium uppercase tracking-wide text-muted"
        >
          URL <span className="normal-case">(optional)</span>
        </label>
        <input
          id="problem-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://leetcode.com/problems/…"
          className="rounded-lg bg-surface px-3 py-2.5 text-sm outline-none placeholder:text-muted"
        />
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <label className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Patterns
        </label>
        <div className="flex flex-wrap gap-2">
          {patterns.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => togglePattern(p.id)}
              className={`rounded-full border px-3 py-1.5 text-xs ${
                selectedPatterns.has(p.id)
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-edge text-muted"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex gap-3">
        <fieldset className="flex flex-1 flex-col gap-2">
          <label
            htmlFor="problem-minutes"
            className="text-[11px] font-medium uppercase tracking-wide text-muted"
          >
            Minutes <span className="normal-case">(optional)</span>
          </label>
          <input
            id="problem-minutes"
            type="number"
            min="0"
            inputMode="numeric"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder="20"
            className="rounded-lg bg-surface px-3 py-2.5 text-sm outline-none placeholder:text-muted"
          />
        </fieldset>
        <fieldset className="flex flex-[2] flex-col gap-2">
          <label className="text-[11px] font-medium uppercase tracking-wide text-muted">
            Outcome
          </label>
          <select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as DsaOutcome)}
            className="rounded-lg bg-surface px-3 py-2.5 text-sm outline-none"
          >
            {DSA_OUTCOMES.map((o) => (
              <option key={o} value={o}>
                {OUTCOME_LABELS[o]}
              </option>
            ))}
          </select>
        </fieldset>
      </div>

      <fieldset className="flex flex-col gap-2">
        <label
          htmlFor="problem-notes"
          className="text-[11px] font-medium uppercase tracking-wide text-muted"
        >
          Key insight <span className="normal-case">(optional)</span>
        </label>
        <textarea
          id="problem-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="The trick, in your own words — hidden on re-solve until you reveal it."
          className="rounded-lg bg-surface px-3 py-2.5 text-sm outline-none placeholder:text-muted"
        />
      </fieldset>

      <button
        type="submit"
        disabled={saving || !title.trim()}
        className="rounded-xl bg-accent py-3.5 font-medium text-background disabled:opacity-50"
      >
        {saving ? "Saving…" : "Log problem"}
      </button>

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-full bg-surface-2 px-4 py-2 text-sm shadow-lg">
          {toast}
        </div>
      )}
    </form>
  );
}
