"use client";

import type { ReactNode } from "react";
import type { TooltipContentProps } from "recharts";

// Shared theming for all Recharts charts: recessive grid/axes, dark tooltip,
// text in text tokens (never series colors), one-line caption per chart.

export const GRID = "#2a2a2f";
export const TICK = { fill: "#8f8d87", fontSize: 10 } as const;
export const ACCENT = "#d8b878";

// Validated (dataviz six checks, dark surface #19191c):
export const MATURITY_COLORS = {
  learning: "#c98500",
  reviewing: "#3987e5",
  mastered: "#199e70",
};
export const DIFFICULTY_SERIES = {
  EASY: "#199e70",
  MEDIUM: "#c98500",
  HARD: "#e66767",
};

export function ChartCard({
  title,
  caption,
  children,
}: {
  title: string;
  caption: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-edge bg-surface p-3.5">
      <h2 className="text-[11px] font-medium uppercase tracking-wide text-muted">
        {title}
      </h2>
      {children}
      <p className="text-xs leading-snug text-muted">{caption}</p>
    </section>
  );
}

interface TooltipRow {
  name?: string | number;
  value?: unknown;
  color?: string;
}

export function DarkTooltip({
  active,
  payload,
  label,
  render,
}: Partial<Omit<TooltipContentProps<number, string>, "formatter">> & {
  render?: (row: TooltipRow) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-edge bg-surface-2 px-3 py-2 text-xs shadow-lg">
      {label !== undefined && <p className="mb-1 text-muted">{String(label)}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-1.5 text-foreground">
          {p.color && (
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: p.color }}
            />
          )}
          {render ? render(p) : `${p.name}: ${p.value}`}
        </p>
      ))}
    </div>
  );
}

export function LegendRow({
  items,
}: {
  items: { label: string; color: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5 text-[11px] text-muted">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}
