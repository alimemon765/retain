"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setBlockCompleted } from "@/app/plan-actions";
import { BLOCK_COLORS, isWorkKind } from "@/lib/block-style";
import { toMinutes } from "@/lib/timetable";
import type { BlockKind } from "@/lib/types";
import type { PlannedBlockRow } from "@/lib/queries-planner";

/**
 * Two lines at the top of Today: what I should be doing now, and what's next.
 * Deliberately minimal — Today stays the fast daily screen, not the planner.
 */
export function NowNext({ blocks }: { blocks: PlannedBlockRow[] }) {
  const router = useRouter();
  const [nowMin, setNowMin] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNowMin(d.getHours() * 60 + d.getMinutes());
    };
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, []);

  if (blocks.length === 0 || nowMin === null) return null;

  const current = blocks.find(
    (b) => nowMin >= toMinutes(b.startTime) && nowMin < toMinutes(b.endTime)
  );
  const next = blocks.find(
    (b) => toMinutes(b.startTime) > nowMin && isWorkKind(b.kind)
  );
  if (!current && !next) return null;

  async function complete(id: string) {
    setBusy(true);
    try {
      await setBlockCompleted(id, true);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const currentColor = current
    ? BLOCK_COLORS[current.kind as BlockKind] ?? "#5f5f68"
    : "#5f5f68";

  return (
    <Link
      href="/planner"
      className="flex flex-col gap-1 rounded-lg border border-edge bg-surface px-3.5 py-2.5"
      style={{ borderLeft: `3px solid ${currentColor}` }}
    >
      <span className="flex items-center gap-2 text-sm">
        <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted">
          now
        </span>
        <span
          className={`min-w-0 flex-1 truncate ${current?.completed ? "text-muted line-through" : ""}`}
        >
          {current ? current.title : "nothing scheduled"}
        </span>
        {current && isWorkKind(current.kind) && !current.completed && (
          <button
            type="button"
            aria-label="Complete current block"
            disabled={busy}
            onClick={(e) => {
              e.preventDefault();
              void complete(current.id);
            }}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-edge text-[11px] text-muted"
          >
            ✓
          </button>
        )}
      </span>
      {next && (
        <span className="flex items-center gap-2 text-xs text-muted">
          <span className="shrink-0 text-[10px] uppercase tracking-wide">next</span>
          <span className="font-mono">{next.startTime}</span>
          <span className="min-w-0 flex-1 truncate">{next.title}</span>
        </span>
      )}
    </Link>
  );
}
