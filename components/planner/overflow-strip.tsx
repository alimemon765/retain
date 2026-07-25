"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getOverflow, pushTaskToTomorrow } from "@/app/plan-actions";
import { BLOCK_COLORS } from "@/lib/block-style";
import type { BlockKind } from "@/lib/types";

interface OverflowItem {
  id: string;
  title: string;
  kind: string;
  estimateMins: number;
  taskId: string | null;
}

export function OverflowStrip({ dateISO }: { dateISO: string }) {
  const router = useRouter();
  const [items, setItems] = useState<OverflowItem[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getOverflow(dateISO).then((r) => {
      if (!cancelled) setItems(r);
    });
    return () => {
      cancelled = true;
    };
  }, [dateISO]);

  if (!items || items.length === 0) return null;

  async function push(taskId: string) {
    setBusy(true);
    try {
      await pushTaskToTomorrow(taskId);
      setItems((cur) => cur?.filter((i) => i.taskId !== taskId) ?? null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-edge bg-surface p-3.5">
      <h2 className="text-[11px] font-medium uppercase tracking-wide text-muted">
        Didn&apos;t fit today ({items.length})
      </h2>
      <div className="flex flex-col gap-1.5">
        {items.slice(0, 8).map((i) => (
          <div
            key={i.id}
            className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm"
          >
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: BLOCK_COLORS[i.kind as BlockKind] }}
            />
            <span className="min-w-0 flex-1 truncate">{i.title}</span>
            <span className="shrink-0 text-[11px] text-muted">
              {i.estimateMins}m
            </span>
            {i.taskId && (
              <button
                type="button"
                disabled={busy}
                onClick={() => push(i.taskId!)}
                className="shrink-0 text-[11px] text-accent underline"
              >
                tomorrow
              </button>
            )}
          </div>
        ))}
        {items.length > 8 && (
          <p className="text-[11px] text-muted">+{items.length - 8} more</p>
        )}
      </div>
      <p className="text-[11px] text-muted">
        Reviews and re-solves stay due and come back tomorrow on their own.
      </p>
    </section>
  );
}
