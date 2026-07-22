"use client";

import { useState } from "react";
import Link from "next/link";
import { submitSkillReview } from "@/app/skill-actions";
import { SKILL_CATEGORY_COLORS } from "@/lib/skills";
import { LevelPicker } from "./level-picker";

interface ReviewSkill {
  id: string;
  name: string;
  category: string;
  currentLevel: number | null;
  targetLevel: number;
  nextAction: string | null;
}

export function SkillsReviewFlow({ skills }: { skills: ReviewSkill[] }) {
  const [index, setIndex] = useState(0);
  const [level, setLevel] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [nextAction, setNextAction] = useState(skills[0]?.nextAction ?? "");
  const [saving, setSaving] = useState(false);

  if (skills.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-edge bg-surface px-6 py-12 text-center text-sm text-muted">
        No active skills to review — add some from Log → Skill.
      </p>
    );
  }

  if (index >= skills.length) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-edge bg-surface px-6 py-12 text-center">
        <p className="text-lg font-medium">Review complete.</p>
        <p className="text-sm text-muted">
          {skills.length} {skills.length === 1 ? "skill" : "skills"} snapshotted.
          See you in ~90 days.
        </p>
        <Link href="/" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background">
          Back to Today
        </Link>
      </div>
    );
  }

  const skill = skills[index];
  const color = SKILL_CATEGORY_COLORS[skill.category] ?? "#8a93a6";

  async function save() {
    if (level === null || saving) return;
    setSaving(true);
    try {
      await submitSkillReview({
        skillId: skill.id,
        level,
        note: note || undefined,
        nextAction: nextAction || undefined,
      });
      const next = index + 1;
      setIndex(next);
      setLevel(null);
      setNote("");
      setNextAction(skills[next]?.nextAction ?? "");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">
          {index + 1} of {skills.length}
        </span>
        <div className="flex gap-1">
          {skills.map((_, i) => (
            <span
              key={i}
              className={`h-1 w-5 rounded-full ${i < index ? "bg-accent" : i === index ? "bg-foreground" : "bg-surface-2"}`}
            />
          ))}
        </div>
      </div>

      <div
        className="rounded-xl border border-edge bg-surface p-4"
        style={{ borderLeft: `3px solid ${color}` }}
      >
        <p className="text-lg font-semibold" style={{ color }}>
          {skill.name}
        </p>
        <p className="mt-0.5 text-xs text-muted">
          previously level {skill.currentLevel ?? "—"} · target {skill.targetLevel}
        </p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <label className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Honest current level
        </label>
        <LevelPicker value={level} onChange={setLevel} accent={color} />
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <label
          htmlFor="review-note"
          className="text-[11px] font-medium uppercase tracking-wide text-muted"
        >
          Note <span className="normal-case">(optional)</span>
        </label>
        <input
          id="review-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What changed since last time?"
          className="rounded-lg bg-surface px-3 py-2.5 text-sm outline-none placeholder:text-muted"
        />
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <label
          htmlFor="review-next-action"
          className="text-[11px] font-medium uppercase tracking-wide text-muted"
        >
          Next action
        </label>
        <input
          id="review-next-action"
          value={nextAction}
          onChange={(e) => setNextAction(e.target.value)}
          placeholder="One concrete step"
          className="rounded-lg bg-surface px-3 py-2.5 text-sm outline-none placeholder:text-muted"
        />
      </fieldset>

      <button
        type="button"
        onClick={save}
        disabled={level === null || saving}
        className="rounded-xl bg-accent py-3.5 font-medium text-background disabled:opacity-50"
      >
        {saving ? "Saving…" : index + 1 === skills.length ? "Save & finish" : "Save & next"}
      </button>
    </div>
  );
}
