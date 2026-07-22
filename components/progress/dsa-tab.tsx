import { prisma } from "@/lib/db";
import { today } from "@/lib/dates";
import {
  patternMastery,
  solvedOverTime,
  timeToSolveTrend,
  unaidedRate,
} from "@/lib/analytics-dsa";
import {
  PatternMasteryChart,
  SolvedOverTimeChart,
  TimeToSolveChart,
  UnaidedRateChart,
} from "./dsa-charts";
import { PracticeSetBuilder } from "@/components/practice-set";

export async function DsaTab() {
  const now = today();
  const [attempts, problems] = await Promise.all([
    prisma.attempt.findMany({
      select: {
        attemptedAt: true,
        outcome: true,
        minutesTaken: true,
        problem: {
          select: {
            difficulty: true,
            patterns: { select: { pattern: { select: { name: true } } } },
          },
        },
      },
    }),
    prisma.problem.findMany({
      select: { firstSolved: true, difficulty: true },
    }),
  ]);

  const flatAttempts = attempts.map((a) => ({
    attemptedAt: a.attemptedAt,
    outcome: a.outcome,
    minutesTaken: a.minutesTaken,
    difficulty: a.problem.difficulty,
    patterns: a.problem.patterns.map((p) => p.pattern.name),
  }));

  const tiles = [
    { label: "Problems", value: String(problems.length) },
    { label: "Attempts", value: String(attempts.length) },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-2">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-edge bg-surface p-3.5">
            <p className="text-xl font-semibold">{t.value}</p>
            <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted">
              {t.label}
            </p>
          </div>
        ))}
      </div>

      <PracticeSetBuilder />
      <PatternMasteryChart data={patternMastery(flatAttempts)} />
      <SolvedOverTimeChart data={solvedOverTime(problems, now)} />
      <TimeToSolveChart data={timeToSolveTrend(flatAttempts, now)} />
      <UnaidedRateChart data={unaidedRate(flatAttempts, now)} />
    </div>
  );
}
