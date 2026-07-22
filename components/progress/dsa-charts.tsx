"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  MedianPoint,
  PatternMasteryRow,
  RatePoint,
  SolvedPoint,
} from "@/lib/analytics-dsa";
import {
  ACCENT,
  ChartCard,
  DarkTooltip,
  DIFFICULTY_SERIES,
  GRID,
  LegendRow,
  TICK,
} from "@/components/charts/chart-kit";

const DIFF_LEGEND = [
  { label: "Easy", color: DIFFICULTY_SERIES.EASY },
  { label: "Medium", color: DIFFICULTY_SERIES.MEDIUM },
  { label: "Hard", color: DIFFICULTY_SERIES.HARD },
];

export function PatternMasteryChart({ data }: { data: PatternMasteryRow[] }) {
  if (data.length === 0) {
    return (
      <ChartCard
        title="Pattern mastery — worst first"
        caption="Attempts and % solved unaided, per pattern. The top of this list is your next study plan."
      >
        <p className="py-4 text-center text-sm text-muted">
          No attempts yet — log problems to see pattern accuracy.
        </p>
      </ChartCard>
    );
  }
  return (
    <ChartCard
      title="Pattern mastery — worst first"
      caption="Attempts and % solved unaided, per pattern. The top of this list is your next study plan."
    >
      <div className="flex flex-col gap-2.5">
        {data.map((row) => (
          <div key={row.pattern} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-medium">{row.pattern}</span>
              <span className="text-muted">
                {row.unaidedPct}% unaided · {row.attempts}{" "}
                {row.attempts === 1 ? "attempt" : "attempts"}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${row.unaidedPct}%`,
                  backgroundColor:
                    row.unaidedPct < 50
                      ? DIFFICULTY_SERIES.HARD
                      : row.unaidedPct < 75
                        ? DIFFICULTY_SERIES.MEDIUM
                        : DIFFICULTY_SERIES.EASY,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}

export function SolvedOverTimeChart({ data }: { data: SolvedPoint[] }) {
  return (
    <ChartCard
      title="Problems solved — cumulative"
      caption="Total distinct problems solved, split by difficulty. Steady growth beats bursts."
    >
      <LegendRow items={DIFF_LEGEND} />
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={false} interval={2} />
          <YAxis tick={TICK} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip content={<DarkTooltip />} />
          {(["EASY", "MEDIUM", "HARD"] as const).map((d) => (
            <Area
              key={d}
              type="monotone"
              dataKey={d}
              name={d.charAt(0) + d.slice(1).toLowerCase()}
              stackId="s"
              stroke={DIFFICULTY_SERIES[d]}
              fill={DIFFICULTY_SERIES[d]}
              fillOpacity={0.5}
              strokeWidth={1}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function TimeToSolveChart({ data }: { data: MedianPoint[] }) {
  return (
    <ChartCard
      title="Time to solve — median minutes"
      caption="Monthly median minutes per difficulty. The honest progress metric: same problems, less time."
    >
      <LegendRow items={DIFF_LEGEND} />
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="month" tick={TICK} tickLine={false} axisLine={false} />
          <YAxis tick={TICK} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip content={<DarkTooltip render={(p) => `${p.name}: ${p.value ?? "—"} min`} />} />
          {(["EASY", "MEDIUM", "HARD"] as const).map((d) => (
            <Line
              key={d}
              type="monotone"
              dataKey={d}
              name={d.charAt(0) + d.slice(1).toLowerCase()}
              stroke={DIFFICULTY_SERIES[d]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function UnaidedRateChart({ data }: { data: RatePoint[] }) {
  return (
    <ChartCard
      title="Unaided rate — weekly"
      caption="% of attempts solved without hints or solutions. This going up is real learning."
    >
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={false} interval={2} />
          <YAxis tick={TICK} tickLine={false} axisLine={false} domain={[0, 100]} ticks={[0, 50, 100]} />
          <Tooltip
            content={<DarkTooltip render={(p) => (p.value == null ? "no attempts" : `${p.value}% unaided`)} />}
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
