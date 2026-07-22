"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ACCENT,
  ChartCard,
  DarkTooltip,
  GRID,
  LegendRow,
  TICK,
} from "@/components/charts/chart-kit";

export interface RadarRow {
  skill: string;
  current: number;
  target: number;
}

export function SkillRadarChart({ data }: { data: RadarRow[] }) {
  if (data.length < 3) return null; // a radar needs ≥3 axes to be readable
  return (
    <ChartCard
      title="Current vs target"
      caption="Solid = where you are; outline = where you want to be. The gaps are the roadmap."
    >
      <LegendRow
        items={[
          { label: "Current", color: ACCENT },
          { label: "Target", color: "#8a93a6" },
        ]}
      />
      <ResponsiveContainer width="100%" height={240}>
        <RadarChart data={data} outerRadius="70%">
          <PolarGrid stroke={GRID} />
          <PolarAngleAxis dataKey="skill" tick={{ fill: "#8f8d87", fontSize: 11 }} />
          <PolarRadiusAxis domain={[0, 5]} tick={false} axisLine={false} tickCount={6} />
          <Tooltip content={<DarkTooltip />} />
          <Radar
            isAnimationActive={false}
            name="Target"
            dataKey="target"
            stroke="#8a93a6"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            fill="transparent"
          />
          <Radar
            isAnimationActive={false}
            name="Current"
            dataKey="current"
            stroke={ACCENT}
            strokeWidth={2}
            fill={ACCENT}
            fillOpacity={0.25}
          />
        </RadarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export interface ProgressionSeries {
  name: string;
  color: string;
  points: { label: string; level: number }[];
}

export function LevelProgressionChart({ series }: { series: ProgressionSeries[] }) {
  if (series.length === 0) return null;

  // Merge per-skill points into one x-domain of snapshot labels.
  const labels = [...new Set(series.flatMap((s) => s.points.map((p) => p.label)))];
  const data = labels.map((label) => {
    const row: Record<string, string | number | null> = { label };
    for (const s of series) {
      row[s.name] = s.points.find((p) => p.label === label)?.level ?? null;
    }
    return row;
  });

  return (
    <ChartCard
      title="Level progression"
      caption="Each line is a skill's snapshot history from quarterly reviews."
    >
      <LegendRow items={series.map((s) => ({ label: s.name, color: s.color }))} />
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={false} />
          <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={TICK} tickLine={false} axisLine={false} />
          <Tooltip content={<DarkTooltip />} />
          {series.map((s) => (
            <Line
              key={s.name}
              isAnimationActive={false}
              type="stepAfter"
              dataKey={s.name}
              stroke={s.color}
              strokeWidth={2}
              dot={{ r: 3, fill: s.color, strokeWidth: 0 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
