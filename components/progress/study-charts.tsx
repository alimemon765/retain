"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  CoverageRow,
  ForecastPoint,
  MaturityPoint,
  WeekPoint,
} from "@/lib/analytics";
import {
  ACCENT,
  ChartCard,
  DarkTooltip,
  GRID,
  LegendRow,
  MATURITY_COLORS,
  TICK,
} from "@/components/charts/chart-kit";

export function LoadForecastChart({ data }: { data: ForecastPoint[] }) {
  return (
    <ChartCard
      title="Review load — next 30 days"
      caption="Reviews due each upcoming day; today includes everything overdue. A spike before an exam means start earlier."
    >
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="label"
            tick={TICK}
            tickLine={false}
            axisLine={false}
            interval={6}
          />
          <YAxis tick={TICK} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "#ffffff0a" }}
            content={<DarkTooltip render={(p) => `${p.value} due`} />}
          />
          <Bar dataKey="count" fill={ACCENT} radius={[3, 3, 0, 0]} maxBarSize={10} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function RetentionChart({ data }: { data: WeekPoint[] }) {
  return (
    <ChartCard
      title="Retention trend — weekly"
      caption="% of reviews rated Good or Easy. Falling retention means you're adding topics faster than you can consolidate them."
    >
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={false} interval={2} />
          <YAxis tick={TICK} tickLine={false} axisLine={false} domain={[0, 100]} ticks={[0, 50, 100]} />
          <Tooltip
            content={
              <DarkTooltip
                render={(p) => (p.value == null ? "no reviews" : `${p.value}% retained`)}
              />
            }
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={ACCENT}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function MaturityChart({ data }: { data: MaturityPoint[] }) {
  return (
    <ChartCard
      title="Topic maturity — last 12 weeks"
      caption="How your topics move from Learning through Reviewing to Mastered. The green band growing is the whole point."
    >
      <LegendRow
        items={[
          { label: "Learning", color: MATURITY_COLORS.learning },
          { label: "Reviewing", color: MATURITY_COLORS.reviewing },
          { label: "Mastered", color: MATURITY_COLORS.mastered },
        ]}
      />
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={false} interval={2} />
          <YAxis tick={TICK} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip content={<DarkTooltip />} />
          <Area
            type="monotone"
            dataKey="learning"
            name="Learning"
            stackId="m"
            stroke={MATURITY_COLORS.learning}
            fill={MATURITY_COLORS.learning}
            fillOpacity={0.5}
            strokeWidth={1}
          />
          <Area
            type="monotone"
            dataKey="reviewing"
            name="Reviewing"
            stackId="m"
            stroke={MATURITY_COLORS.reviewing}
            fill={MATURITY_COLORS.reviewing}
            fillOpacity={0.5}
            strokeWidth={1}
          />
          <Area
            type="monotone"
            dataKey="mastered"
            name="Mastered"
            stackId="m"
            stroke={MATURITY_COLORS.mastered}
            fill={MATURITY_COLORS.mastered}
            fillOpacity={0.5}
            strokeWidth={1}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function CoverageChart({ data }: { data: CoverageRow[] }) {
  if (data.length === 0) return null;
  return (
    <ChartCard
      title="Subject coverage"
      caption="% of each subject's topics reviewed successfully 3+ times — how consolidated the subject actually is."
    >
      <div className="flex flex-col gap-2.5">
        {data.map((row) => (
          <div key={row.subject} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-medium" style={{ color: row.color }}>
                {row.subject}
              </span>
              <span className="text-muted">
                {row.coveredPct}%
                {row.daysToExam !== null &&
                  row.daysToExam >= 0 &&
                  ` · exam in ${row.daysToExam}d`}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full"
                style={{ width: `${row.coveredPct}%`, backgroundColor: row.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}
