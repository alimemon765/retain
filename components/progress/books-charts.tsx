"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FinishedPoint, PagesPoint } from "@/lib/analytics-books";
import {
  ACCENT,
  ChartCard,
  DarkTooltip,
  GRID,
  LegendRow,
  TICK,
} from "@/components/charts/chart-kit";

// Validated on dark surface (dataviz six checks): blue / green / violet.
export const BOOK_CATEGORY_SERIES = {
  TECHNICAL: "#3987e5",
  NONFICTION: "#199e70",
  FICTION: "#9085e9",
};

export function PagesPerDayChart({ data }: { data: PagesPoint[] }) {
  return (
    <ChartCard
      title="Pages per day — last 90 days"
      caption="Daily pages with a 7-day average line. Consistency matters more than big days."
    >
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={false} interval={20} />
          <YAxis tick={TICK} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "#ffffff0a" }}
            content={<DarkTooltip />}
          />
          {/* isAnimationActive=false: Recharts 3.10 leaves ComposedChart bars
              stuck at zero height when the entry animation runs. */}
          <Bar
            dataKey="pages"
            fill="#8a93a6"
            barSize={3}
            radius={[1.5, 1.5, 0, 0]}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="avg7"
            name="7-day avg"
            stroke={ACCENT}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function FinishedPerMonthChart({ data }: { data: FinishedPoint[] }) {
  return (
    <ChartCard
      title="Books finished per month"
      caption="Finished books by category over the last year."
    >
      <LegendRow
        items={[
          { label: "Technical", color: BOOK_CATEGORY_SERIES.TECHNICAL },
          { label: "Nonfiction", color: BOOK_CATEGORY_SERIES.NONFICTION },
          { label: "Fiction", color: BOOK_CATEGORY_SERIES.FICTION },
        ]}
      />
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="month" tick={TICK} tickLine={false} axisLine={false} />
          <YAxis tick={TICK} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip cursor={{ fill: "#ffffff0a" }} content={<DarkTooltip />} />
          {(["TECHNICAL", "NONFICTION", "FICTION"] as const).map((c) => (
            <Bar
              key={c}
              dataKey={c}
              name={c.charAt(0) + c.slice(1).toLowerCase()}
              stackId="f"
              fill={BOOK_CATEGORY_SERIES[c]}
              maxBarSize={16}
              isAnimationActive={false}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
