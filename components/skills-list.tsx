"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  addEvidence,
  deleteEvidence,
  deleteSkill,
  updateSkill,
} from "@/app/skill-actions";
import { SKILL_CATEGORY_COLORS } from "@/lib/skills";
import type { SkillRow } from "@/lib/queries-skills";
import type { EvidenceKind } from "@/lib/types";

const EVIDENCE_KINDS: EvidenceKind[] = [
  "PROJECT",
  "COURSE",
  "BOOK",
  "ARTICLE",
  "PROBLEM_SET",
];

export function SkillsList({ skills }: { skills: SkillRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);

  if (skills.length === 0) {
    return (
      <p className="text-sm text-muted">
        No skills yet — add one from Log → Skill.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {skills.map((s) => (
        <SkillCard
          key={s.id}
          skill={s}
          open={open === s.id}
          onToggle={() => setOpen((o) => (o === s.id ? null : s.id))}
          refresh={() => router.refresh()}
        />
      ))}
    </div>
  );
}

export function LevelDots({
  current,
  target,
  color,
}: {
  current: number | null;
  target: number;
  color: string;
}) {
  return (
    <span className="flex items-center gap-1" title={`level ${current ?? "—"} of target ${target}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className="h-2 w-2 rounded-full"
          style={{
            backgroundColor:
              current !== null && n <= current ? color : "var(--surface-2)",
            outline: n === target ? `1.5px solid ${color}` : undefined,
            outlineOffset: n === target ? "1.5px" : undefined,
          }}
        />
      ))}
    </span>
  );
}

function SkillCard({
  skill,
  open,
  onToggle,
  refresh,
}: {
  skill: SkillRow;
  open: boolean;
  onToggle: () => void;
  refresh: () => void;
}) {
  const color = SKILL_CATEGORY_COLORS[skill.category] ?? "#8a93a6";
  const [editingAction, setEditingAction] = useState(false);
  const [actionValue, setActionValue] = useState(skill.nextAction ?? "");

  async function saveAction() {
    await updateSkill(skill.id, { nextAction: actionValue || null });
    setEditingAction(false);
    refresh();
  }

  async function archive() {
    await updateSkill(skill.id, { archived: !skill.archived });
    refresh();
  }

  async function remove() {
    if (confirm(`Delete "${skill.name}" and its history?`)) {
      await deleteSkill(skill.id);
      refresh();
    }
  }

  return (
    <div
      className={`rounded-xl border border-edge bg-surface ${skill.archived ? "opacity-50" : ""}`}
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 p-3.5 text-left"
      >
        <div className="min-w-0">
          <p className="font-medium" style={{ color }}>
            {skill.name}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted">
            {skill.nextAction ?? "no next action set"}
          </p>
        </div>
        <LevelDots current={skill.currentLevel} target={skill.targetLevel} color={color} />
      </button>

      {open && (
        <div className="flex flex-col gap-3 border-t border-edge p-3.5">
          <p className="text-xs text-muted">
            Level {skill.currentLevel ?? "—"} → target {skill.targetLevel}
            {skill.lastReviewedAt &&
              ` · last reviewed ${format(new Date(skill.lastReviewedAt), "d MMM yyyy")}`}
          </p>

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
              Next action
            </span>
            {editingAction ? (
              <div className="flex gap-2">
                <input
                  value={actionValue}
                  onChange={(e) => setActionValue(e.target.value)}
                  autoFocus
                  className="flex-1 rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={saveAction}
                  className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-background"
                >
                  Save
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setEditingAction(true)}
                className="rounded-lg bg-surface-2 px-3 py-2 text-left text-sm"
              >
                {skill.nextAction ?? <span className="text-muted">set one…</span>}
              </button>
            )}
          </div>

          <EvidenceSection skill={skill} refresh={refresh} />

          <div className="flex gap-3 text-[11px] text-muted">
            <button type="button" onClick={archive} className="underline">
              {skill.archived ? "unarchive" : "archive"}
            </button>
            <button type="button" onClick={remove} className="text-again underline">
              delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EvidenceSection({ skill, refresh }: { skill: SkillRow; refresh: () => void }) {
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<EvidenceKind>("PROJECT");
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");

  async function save() {
    if (!label.trim()) return;
    await addEvidence({ skillId: skill.id, kind, label, url: url || undefined });
    setLabel("");
    setUrl("");
    setAdding(false);
    refresh();
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Evidence ({skill.evidence.length})
        </span>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="text-[11px] text-accent underline"
        >
          {adding ? "cancel" : "+ add"}
        </button>
      </div>

      {adding && (
        <div className="flex flex-col gap-2 rounded-lg bg-surface-2 p-3">
          <div className="flex gap-2">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as EvidenceKind)}
              className="rounded-lg bg-background px-2 py-2 text-sm outline-none"
            >
              {EVIDENCE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k.replace("_", " ").toLowerCase()}
                </option>
              ))}
            </select>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="What was it?"
              className="flex-1 rounded-lg bg-background px-3 py-2 text-sm outline-none placeholder:text-muted"
            />
          </div>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="URL (optional)"
            className="rounded-lg bg-background px-3 py-2 text-sm outline-none placeholder:text-muted"
          />
          <button
            type="button"
            onClick={save}
            className="self-start rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-background"
          >
            Save
          </button>
        </div>
      )}

      {skill.evidence.map((e) => (
        <div
          key={e.id}
          className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm"
        >
          <span className="min-w-0 truncate">
            <span className="mr-2 text-[10px] uppercase text-muted">
              {e.kind.replace("_", " ").toLowerCase()}
            </span>
            {e.url ? (
              <a href={e.url} target="_blank" rel="noreferrer" className="underline decoration-edge underline-offset-2">
                {e.label}
              </a>
            ) : (
              e.label
            )}
          </span>
          <button
            type="button"
            onClick={() => deleteEvidence(e.id).then(refresh)}
            className="text-[11px] text-muted underline"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
