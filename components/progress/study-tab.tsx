import { format, startOfWeek, addDays, addWeeks, isAfter } from "date-fns";
import { getActiveTopics, getStatsData } from "@/lib/queries";
import { prisma } from "@/lib/db";
import { dayKey, today } from "@/lib/dates";
import {
  forecastLoad,
  maturityTimeline,
  subjectCoverage,
  weeklyRetention,
} from "@/lib/analytics";
import {
  CoverageChart,
  LoadForecastChart,
  MaturityChart,
  RetentionChart,
} from "./study-charts";

function heatColor(count: number): string {
  if (count === 0) return "var(--surface-2)";
  if (count <= 2) return "#3d3524";
  if (count <= 5) return "#6e5c33";
  if (count <= 9) return "#a58a4b";
  return "var(--accent)";
}

export async function StudyTab() {
  const now = today();
  const [stats, activeTopics, reviews, topicHistories, subjects] =
    await Promise.all([
      getStatsData(),
      getActiveTopics(),
      prisma.review.findMany({ select: { reviewedAt: true, rating: true } }),
      prisma.topic.findMany({
        where: { status: { not: "SUSPENDED" } },
        select: {
          createdAt: true,
          reviews: {
            orderBy: { reviewedAt: "asc" },
            select: { reviewedAt: true, rating: true, intervalAfter: true },
          },
        },
      }),
      prisma.subject.findMany({
        select: {
          name: true,
          color: true,
          examDate: true,
          topics: {
            where: { status: { not: "SUSPENDED" } },
            select: { repetitions: true },
          },
        },
      }),
    ]);

  const forecast = forecastLoad(
    activeTopics.map((t) => t.effectiveNextReview),
    now
  );
  const retention = weeklyRetention(reviews, now);
  const maturity = maturityTimeline(topicHistories, now);
  const coverage = subjectCoverage(subjects, now);

  // 26 weeks of columns, GitHub style (Mon-start weeks).
  const firstWeek = startOfWeek(addWeeks(now, -25), { weekStartsOn: 1 });
  const weeks = Array.from({ length: 26 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => addDays(addWeeks(firstWeek, w), d))
  );

  const tiles = [
    { label: "Current streak", value: `${stats.currentStreak}d` },
    { label: "Longest streak", value: `${stats.longestStreak}d` },
    { label: "Total reviews", value: String(stats.totalReviews) },
    {
      label: "Retention (30d)",
      value: stats.retention !== null ? `${stats.retention}%` : "—",
    },
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

      <LoadForecastChart data={forecast} />
      <RetentionChart data={retention} />
      <MaturityChart data={maturity} />
      <CoverageChart data={coverage} />

      <section className="flex flex-col gap-2">
        <h2 className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Review activity — last 6 months
        </h2>
        {/* rtl on the scroller starts it at the newest week; ltr restores order inside */}
        <div
          className="overflow-x-auto rounded-xl border border-edge bg-surface p-3"
          style={{ direction: "rtl" }}
        >
          <div
            className="flex gap-[3px]"
            style={{ minWidth: "max-content", direction: "ltr" }}
          >
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.map((d) => {
                  const future = isAfter(d, now);
                  const count = stats.heatmap[dayKey(d)] ?? 0;
                  return (
                    <div
                      key={d.toISOString()}
                      title={`${format(d, "d MMM")}: ${count} reviews`}
                      className="h-[11px] w-[11px] rounded-[2px]"
                      style={{
                        backgroundColor: future ? "transparent" : heatColor(count),
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-[11px] font-medium uppercase tracking-wide text-muted">
          By subject
        </h2>
        {stats.perSubject.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between rounded-xl border border-edge bg-surface px-3.5 py-3"
            style={{ borderLeft: `3px solid ${s.color}` }}
          >
            <div>
              <p className="text-sm font-medium" style={{ color: s.color }}>
                {s.name}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {s.topics} topics · {s.reviews} reviews
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold">
                {s.topics ? Math.round((s.mastered / s.topics) * 100) : 0}%
              </p>
              <p className="text-[10px] uppercase tracking-wide text-muted">
                mastered
              </p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
