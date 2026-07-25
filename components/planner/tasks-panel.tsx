"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  createManualTask,
  deleteManualTask,
  setManualTaskDone,
} from "@/app/planner-actions";
import { MANUAL_TASK_KINDS, type ManualTaskKind } from "@/lib/types";

export interface TaskRow {
  id: string;
  title: string;
  estimateMins: number;
  kind: string;
  priority: number;
  dueDate: Date | null;
  done: boolean;
}

const KIND_LABEL: Record<string, string> = {
  DSA: "DSA",
  READING: "Reading",
  SKILL: "Skill",
  STUDY: "Study",
  ADMIN: "Admin",
};

export function TasksPanel({ tasks }: { tasks: TaskRow[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);

  const open = tasks.filter((t) => !t.done);

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Tasks ({open.length})
        </h2>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="text-[11px] text-accent underline"
        >
          {adding ? "cancel" : "+ add"}
        </button>
      </div>

      {adding && <AddTask onDone={() => { setAdding(false); router.refresh(); }} />}

      {open.length === 0 && !adding && (
        <p className="rounded-xl border border-dashed border-edge bg-surface px-4 py-6 text-center text-xs text-muted">
          Anything one-off you want the planner to find room for.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        {open.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-2 rounded-lg border border-edge bg-surface px-3 py-2.5"
          >
            <button
              type="button"
              aria-label={`Complete ${t.title}`}
              onClick={async () => {
                await setManualTaskDone(t.id, true);
                router.refresh();
              }}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-edge text-[11px] text-muted"
            >
              ✓
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{t.title}</p>
              <p className="text-[11px] text-muted">
                {KIND_LABEL[t.kind] ?? t.kind} · {t.estimateMins}m · P{t.priority}
                {t.dueDate && ` · due ${format(new Date(t.dueDate), "d MMM")}`}
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                await deleteManualTask(t.id);
                router.refresh();
              }}
              className="shrink-0 text-[11px] text-muted"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function AddTask({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [mins, setMins] = useState(30);
  const [kind, setKind] = useState<ManualTaskKind>("STUDY");
  const [priority, setPriority] = useState(3);
  const [due, setDue] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await createManualTask({
        title,
        estimateMins: mins,
        kind,
        priority,
        dueDate: due || undefined,
      });
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-edge bg-surface p-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What needs doing?"
        autoFocus
        className="rounded-lg bg-surface-2 px-3 py-2.5 text-sm outline-none placeholder:text-muted"
      />
      <div className="flex gap-2">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as ManualTaskKind)}
          className="flex-1 rounded-lg bg-surface-2 px-2 py-2 text-sm outline-none"
        >
          {MANUAL_TASK_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
        <input
          type="number"
          min="5"
          step="5"
          value={mins}
          onChange={(e) => setMins(Number(e.target.value))}
          aria-label="Estimate in minutes"
          className="w-20 rounded-lg bg-surface-2 px-2 py-2 text-sm outline-none"
        />
        <select
          value={priority}
          onChange={(e) => setPriority(Number(e.target.value))}
          aria-label="Priority"
          className="rounded-lg bg-surface-2 px-2 py-2 text-sm outline-none"
        >
          {[1, 2, 3, 4, 5].map((p) => (
            <option key={p} value={p}>
              P{p}
            </option>
          ))}
        </select>
      </div>
      <input
        type="date"
        value={due}
        onChange={(e) => setDue(e.target.value)}
        aria-label="Due date"
        className="rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none"
      />
      <button
        type="button"
        onClick={save}
        disabled={!title.trim() || saving}
        className="self-start rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {saving ? "Adding…" : "Add task"}
      </button>
    </div>
  );
}
