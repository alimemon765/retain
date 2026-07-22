"use client";

import { useState } from "react";
import { createSkill } from "@/app/skill-actions";
import { LevelPicker } from "./level-picker";
import type { SkillCategory } from "@/lib/types";

const CATEGORIES: SkillCategory[] = [
  "FRONTEND",
  "BACKEND",
  "ML",
  "DEVOPS",
  "LANGUAGE",
  "OTHER",
];

export function SkillForm() {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<SkillCategory>("FRONTEND");
  const [currentLevel, setCurrentLevel] = useState<number | null>(null);
  const [targetLevel, setTargetLevel] = useState(4);
  const [nextAction, setNextAction] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || currentLevel === null || saving) return;
    setSaving(true);
    try {
      await createSkill({
        name,
        category,
        currentLevel,
        targetLevel,
        nextAction: nextAction || undefined,
      });
      setName("");
      setCurrentLevel(null);
      setNextAction("");
      setToast("Skill added");
      setTimeout(() => setToast(null), 2500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div className="flex gap-3">
        <fieldset className="flex flex-[2] flex-col gap-2">
          <label
            htmlFor="skill-name"
            className="text-[11px] font-medium uppercase tracking-wide text-muted"
          >
            Skill
          </label>
          <input
            id="skill-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. React, Docker, PyTorch"
            required
            className="rounded-lg bg-surface px-3 py-3 outline-none placeholder:text-muted"
          />
        </fieldset>
        <fieldset className="flex flex-1 flex-col gap-2">
          <label className="text-[11px] font-medium uppercase tracking-wide text-muted">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as SkillCategory)}
            className="rounded-lg bg-surface px-3 py-3 text-sm outline-none"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0) + c.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </fieldset>
      </div>

      <fieldset className="flex flex-col gap-2">
        <label className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Where are you now?
        </label>
        <LevelPicker value={currentLevel} onChange={setCurrentLevel} />
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <label className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Target level
        </label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setTargetLevel(n)}
              className={`flex h-10 flex-1 items-center justify-center rounded-lg border text-sm font-medium ${
                targetLevel === n
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-edge text-muted"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <label
          htmlFor="next-action"
          className="text-[11px] font-medium uppercase tracking-wide text-muted"
        >
          Next action <span className="normal-case">(one concrete step)</span>
        </label>
        <input
          id="next-action"
          value={nextAction}
          onChange={(e) => setNextAction(e.target.value)}
          placeholder='e.g. "build a custom hook library"'
          className="rounded-lg bg-surface px-3 py-3 text-sm outline-none placeholder:text-muted"
        />
      </fieldset>

      <button
        type="submit"
        disabled={saving || !name.trim() || currentLevel === null}
        className="rounded-xl bg-accent py-3.5 font-medium text-background disabled:opacity-50"
      >
        {saving ? "Saving…" : "Add skill"}
      </button>

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-full bg-surface-2 px-4 py-2 text-sm shadow-lg">
          {toast}
        </div>
      )}
    </form>
  );
}
