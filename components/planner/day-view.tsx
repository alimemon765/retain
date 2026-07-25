"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  applyPlan,
  deleteBlock,
  extendBlock,
  previewPlan,
  rescheduleBlock,
  setBlockCompleted,
  setBlockLocked,
  type PlanPreview,
} from "@/app/plan-actions";
import { BLOCK_COLORS, blockHref, isWorkKind } from "@/lib/block-style";
import { fromMinutes, toMinutes } from "@/lib/timetable";
import type { BlockKind, FocusMode } from "@/lib/types";
import { FOCUS_MODES } from "@/lib/types";
import type { PlannedBlockRow } from "@/lib/queries-planner";

const FOCUS_LABEL: Record<FocusMode, string> = {
  BALANCED: "Balanced",
  EXAMS: "Exams",
  CP: "CP",
  READING: "Reading",
  SKILLS: "Skills",
};

export function DayView({
  dateISO,
  dateLabel,
  blocks,
  focusMode,
  hasTimetable,
}: {
  dateISO: string;
  dateLabel: string;
  blocks: PlannedBlockRow[];
  focusMode: FocusMode;
  hasTimetable: boolean;
}) {
  const router = useRouter();
  const [focus, setFocus] = useState<FocusMode>(focusMode);
  const [preview, setPreview] = useState<PlanPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [nowMin, setNowMin] = useState<number | null>(null);

  const isToday = dateISO === new Date().toLocaleDateString("en-CA");

  useEffect(() => {
    if (!isToday) return;
    const tick = () => {
      const d = new Date();
      setNowMin(d.getHours() * 60 + d.getMinutes());
    };
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, [isToday]);

  async function runPreview(mode: FocusMode) {
    setBusy(true);
    try {
      setPreview(await previewPlan(dateISO, mode));
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!preview) return;
    setBusy(true);
    try {
      await applyPlan(dateISO, preview.blocks);
      setPreview(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const totals = useMemo(() => {
    const work = blocks.filter((b) => isWorkKind(b.kind));
    const done = work.filter((b) => b.completed).length;
    const mins = work.reduce(
      (n, b) => n + (toMinutes(b.endTime) - toMinutes(b.startTime)),
      0
    );
    return { count: work.length, done, mins };
  }, [blocks]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {FOCUS_MODES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setFocus(m);
              if (preview) void runPreview(m);
            }}
            className={`rounded-full border px-3 py-1.5 text-xs ${
              focus === m
                ? "border-accent bg-accent/15 text-accent"
                : "border-edge text-muted"
            }`}
          >
            {FOCUS_LABEL[m]}
          </button>
        ))}
      </div>

      {blocks.length > 0 && (
        <p className="text-sm text-muted">
          {totals.count} work {totals.count === 1 ? "block" : "blocks"} ·{" "}
          {Math.round(totals.mins / 6) / 10}h · {totals.done} done
        </p>
      )}

      {!hasTimetable && (
        <Link
          href="/planner/setup"
          className="rounded-lg border border-edge bg-surface px-4 py-3 text-sm"
          style={{ borderLeft: "3px solid var(--accent)" }}
        >
          Add your timetable so the planner knows when you&apos;re in college. →
        </Link>
      )}

      {preview ? (
        <PreviewPanel
          preview={preview}
          busy={busy}
          onConfirm={confirm}
          onCancel={() => setPreview(null)}
        />
      ) : (
        <button
          type="button"
          onClick={() => runPreview(focus)}
          disabled={busy}
          className="rounded-xl bg-accent py-3 font-medium text-background disabled:opacity-50"
        >
          {busy ? "Working…" : blocks.length ? "Re-optimize my day" : "Optimize my day"}
        </button>
      )}

      {blocks.length === 0 && !preview && (
        <p className="rounded-xl border border-dashed border-edge bg-surface px-6 py-10 text-center text-sm text-muted">
          Nothing planned for {dateLabel}. Optimize to fill the free hours with
          what&apos;s due.
        </p>
      )}

      <Timeline blocks={blocks} nowMin={nowMin} refresh={() => router.refresh()} />
    </div>
  );
}

function PreviewPanel({
  preview,
  busy,
  onConfirm,
  onCancel,
}: {
  preview: PlanPreview;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-accent/40 bg-surface p-3.5">
      <h2 className="text-[11px] font-medium uppercase tracking-wide text-accent">
        Preview — nothing saved yet
      </h2>

      <p className="text-sm">
        {preview.added.length} new · {preview.kept} unchanged ·{" "}
        {preview.removed.length} replaced
      </p>
      <p className="text-xs text-muted">
        {Math.round(preview.scheduledMinutes / 6) / 10}h of work into{" "}
        {Math.round(preview.freeMinutes / 6) / 10}h free.
      </p>

      {preview.warnings.map((w) => (
        <p key={w} className="rounded-lg bg-again/10 px-3 py-2 text-xs text-again">
          {w}
        </p>
      ))}

      {preview.added.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted">
            What&apos;s being added
          </summary>
          <ul className="mt-1.5 flex flex-col gap-1">
            {preview.added.map((a) => (
              <li key={a} className="font-mono text-[11px] text-good">
                + {a}
              </li>
            ))}
          </ul>
        </details>
      )}

      {preview.removed.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted">
            What&apos;s being replaced
          </summary>
          <ul className="mt-1.5 flex flex-col gap-1">
            {preview.removed.map((r) => (
              <li key={r} className="font-mono text-[11px] text-again">
                − {r}
              </li>
            ))}
          </ul>
        </details>
      )}

      {preview.overflow.length > 0 && (
        <div className="rounded-lg bg-surface-2 p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted">
            Didn&apos;t fit ({preview.overflow.length})
          </p>
          <ul className="mt-1.5 flex flex-col gap-1 text-xs">
            {preview.overflow.slice(0, 6).map((o) => (
              <li key={o.id} className="text-muted">
                {o.title} · {o.estimateMins}m
              </li>
            ))}
            {preview.overflow.length > 6 && (
              <li className="text-muted">+{preview.overflow.length - 6} more</li>
            )}
          </ul>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="flex-1 rounded-lg bg-accent py-2.5 text-sm font-medium text-background disabled:opacity-50"
        >
          {busy ? "Saving…" : "Use this plan"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-lg border border-edge px-4 py-2.5 text-sm text-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function Timeline({
  blocks,
  nowMin,
  refresh,
}: {
  blocks: PlannedBlockRow[];
  nowMin: number | null;
  refresh: () => void;
}) {
  if (blocks.length === 0) return null;
  return (
    <div className="flex flex-col">
      {blocks.map((b, i) => {
        const start = toMinutes(b.startTime);
        const end = toMinutes(b.endTime);
        const isNow = nowMin !== null && nowMin >= start && nowMin < end;
        const nowOffset = isNow ? (nowMin! - start) / (end - start) : 0;
        return (
          <div key={b.id} className="relative">
            {isNow && (
              <div
                className="pointer-events-none absolute inset-x-0 z-10 flex items-center gap-1"
                style={{ top: `${nowOffset * 100}%` }}
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-again" />
                <span className="h-px flex-1 bg-again/70" />
              </div>
            )}
            <BlockCard block={b} isNow={isNow} first={i === 0} refresh={refresh} />
          </div>
        );
      })}
    </div>
  );
}

function BlockCard({
  block,
  isNow,
  first,
  refresh,
}: {
  block: PlannedBlockRow;
  isNow: boolean;
  first: boolean;
  refresh: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const color = BLOCK_COLORS[block.kind as BlockKind] ?? "#5f5f68";
  const work = isWorkKind(block.kind);
  const mins = toMinutes(block.endTime) - toMinutes(block.startTime);
  const href = blockHref(block);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      const res = (await fn()) as { reason?: string } | undefined;
      if (res?.reason) {
        setNote(res.reason);
        setTimeout(() => setNote(null), 2500);
      }
      setMenu(false);
      refresh();
    } finally {
      setBusy(false);
    }
  }

  // Slack rows stay visually quiet — they are the shape of the day, not tasks.
  if (!work) {
    return (
      <div
        className={`flex items-center gap-3 py-1.5 ${first ? "" : "border-t border-edge/40"}`}
      >
        <span className="w-11 shrink-0 font-mono text-[11px] text-muted">
          {block.startTime}
        </span>
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="min-w-0 flex-1 truncate text-xs text-muted">
          {block.title}
        </span>
        <span className="shrink-0 text-[10px] text-muted">{mins}m</span>
      </div>
    );
  }

  return (
    <div
      className={`my-1 rounded-xl border bg-surface p-3 ${
        isNow ? "border-again/50" : "border-edge"
      } ${block.completed ? "opacity-50" : ""}`}
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <div className="flex items-start gap-3">
        <span className="w-11 shrink-0 pt-0.5 font-mono text-[11px] text-muted">
          {block.startTime}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={`text-sm font-medium ${block.completed ? "line-through" : ""}`}
          >
            {href ? (
              <Link href={href} className="underline decoration-edge underline-offset-2">
                {block.title}
              </Link>
            ) : (
              block.title
            )}
          </p>
          <p className="mt-0.5 text-[11px] text-muted">
            {mins}m
            {block.topicIds.length > 0 && ` · ${block.topicIds.length} topics`}
            {block.problemIds.length > 0 && ` · ${block.problemIds.length} problems`}
            {block.locked && " · locked"}
          </p>
        </div>
        <button
          type="button"
          aria-label={block.completed ? "Mark not done" : "Mark done"}
          disabled={busy}
          onClick={() => act(() => setBlockCompleted(block.id, !block.completed))}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm ${
            block.completed
              ? "border-good bg-good/20 text-good"
              : "border-edge text-muted"
          }`}
        >
          ✓
        </button>
        <button
          type="button"
          aria-label="Block options"
          onClick={() => setMenu((v) => !v)}
          className="shrink-0 px-1 text-muted"
        >
          ⋮
        </button>
      </div>

      {menu && (
        <div className="mt-2 flex flex-wrap gap-3 border-t border-edge pt-2 text-[11px]">
          <button
            type="button"
            disabled={busy}
            onClick={() => act(() => rescheduleBlock(block.id))}
            className="text-muted underline"
          >
            reschedule
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => act(() => extendBlock(block.id, 15))}
            className="text-muted underline"
          >
            +15m
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => act(() => setBlockLocked(block.id, !block.locked))}
            className="text-muted underline"
          >
            {block.locked ? "unlock" : "lock"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => act(() => deleteBlock(block.id))}
            className="text-again underline"
          >
            delete
          </button>
        </div>
      )}

      {note && <p className="mt-2 text-[11px] text-again">{note}</p>}
    </div>
  );
}

/** Exported for the week view, which reuses the same colour language. */
export function blockDuration(b: { startTime: string; endTime: string }) {
  return toMinutes(b.endTime) - toMinutes(b.startTime);
}

export { fromMinutes };
