"use client";

import { format, parseISO } from "date-fns";
import type { AssistantDraftResult } from "@/app/assistant-actions";
import type { AssistantTask } from "@/lib/assistant/schema";

type Draft = Extract<AssistantDraftResult, { ok: true }>;

const KIND_LABEL: Record<string, string> = {
  STUDY: "Study",
  DSA: "DSA",
  READING: "Reading",
  SKILL: "Skill",
  ADMIN: "Admin",
};

const dayLabel = (iso: string) => format(parseISO(iso), "EEE d MMM");
const hours = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
};

interface ReviewProps {
  draft: Draft;
  busy: boolean;
  onMove: (taskId: string, iso: string | null) => void;
  onRemove: (taskId: string) => void;
  onCommit: () => void;
  onEdit: () => void;
}

export function AssistantReview({ draft, busy, onMove, onRemove, onCommit, onEdit }: ReviewProps) {
  const totalTasks = draft.tasks.length;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        {totalTasks} {totalTasks === 1 ? "task" : "tasks"} across {draft.window.length}{" "}
        {draft.window.length === 1 ? "day" : "days"}. Nothing is saved until you confirm.
      </p>

      {draft.notes.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
          {draft.notes.map((n) => (
            <li key={n}>• {n}</li>
          ))}
        </ul>
      )}

      {draft.draft.days.map((day) => (
        <DayCard
          key={day.iso}
          day={day}
          window={draft.window}
          busy={busy}
          onMove={onMove}
          onRemove={onRemove}
        />
      ))}

      {draft.draft.overflow.length > 0 && (
        <div className="rounded-lg border border-again/30 bg-again/10 px-3 py-2 text-xs">
          <p className="font-medium text-again">Didn&apos;t fit — saved to Tasks instead</p>
          <ul className="mt-1 flex flex-col gap-0.5 text-muted">
            {draft.draft.overflow.map((o) => (
              <li key={o.taskId}>
                {o.title} — {o.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCommit}
          disabled={busy || totalTasks === 0}
          className="flex-1 rounded-lg bg-accent py-2.5 text-sm font-medium text-background disabled:opacity-50"
        >
          {busy ? "Working…" : "Create plan"}
        </button>
        <button
          type="button"
          onClick={onEdit}
          disabled={busy}
          className="rounded-lg border border-edge px-4 py-2.5 text-sm text-muted"
        >
          Edit text
        </button>
      </div>
    </div>
  );
}

interface DayCardProps {
  day: Draft["draft"]["days"][number];
  window: string[];
  busy: boolean;
  onMove: (taskId: string, iso: string | null) => void;
  onRemove: (taskId: string) => void;
}

function DayCard({ day, window, busy, onMove, onRemove }: DayCardProps) {
  const newMins = day.assignments.reduce((n, a) => n + a.task.estimateMins, 0);
  // Existing blocks that a regenerated day would replace (locked/done ones survive).
  const replaced = day.preview.removed.length;
  const missed = new Set(day.preview.overflow.map((o) => o.id));

  return (
    <section className="rounded-xl border border-edge bg-surface p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-medium">{dayLabel(day.iso)}</h3>
        <span className="text-[11px] text-muted">
          {day.assignments.length ? `${hours(newMins)} new` : "nothing new"}
        </span>
      </div>

      {replaced > 0 && (
        <p className="mb-2 text-[11px] text-again">
          Replaces {replaced} block{replaced === 1 ? "" : "s"} already planned for this day.
        </p>
      )}

      <ul className="flex flex-col gap-1.5">
        {day.assignments.map((a) => (
          <TaskRow
            key={a.instanceId}
            task={a.task}
            iso={day.iso}
            window={window}
            busy={busy}
            unfitted={missed.has(`task:${a.instanceId}`)}
            onMove={onMove}
            onRemove={onRemove}
          />
        ))}
      </ul>

      {day.preview.warnings.map((w) => (
        <p key={w} className="mt-2 text-[11px] text-again">
          {w}
        </p>
      ))}
    </section>
  );
}

interface TaskRowProps {
  task: AssistantTask;
  iso: string;
  window: string[];
  busy: boolean;
  unfitted: boolean;
  onMove: (taskId: string, iso: string | null) => void;
  onRemove: (taskId: string) => void;
}

function TaskRow({ task, iso, window, busy, unfitted, onMove, onRemove }: TaskRowProps) {
  return (
    <li className="flex items-center gap-2 rounded-lg bg-surface-2 px-2.5 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{task.title}</p>
        <p className="text-[11px] text-muted">
          {KIND_LABEL[task.kind] ?? task.kind} · {hours(task.estimateMins)}
          {task.fixedStart && ` · at ${task.fixedStart}`}
          {task.repeatDaily && " · daily"}
          {task.deadline && ` · due ${dayLabel(task.deadline)}`}
          {unfitted && <span className="text-again"> · no slot found</span>}
        </p>
      </div>
      {!task.repeatDaily && (
        <select
          aria-label={`Move ${task.title} to another day`}
          value={task.onDate === iso ? iso : ""}
          disabled={busy}
          onChange={(e) => onMove(task.id, e.target.value || null)}
          className="shrink-0 rounded bg-background px-1.5 py-1 text-[11px] text-muted outline-none"
        >
          <option value="">Any day</option>
          {window.map((d) => (
            <option key={d} value={d}>
              {dayLabel(d)}
            </option>
          ))}
        </select>
      )}
      <button
        type="button"
        aria-label={`Remove ${task.title}`}
        disabled={busy}
        onClick={() => onRemove(task.id)}
        className="shrink-0 px-1 text-xs text-muted"
      >
        ✕
      </button>
    </li>
  );
}
