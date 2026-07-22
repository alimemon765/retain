import { format } from "date-fns";
import { getSkills } from "@/lib/queries-skills";
import { SKILL_CATEGORY_COLORS, SKILL_SERIES } from "@/lib/skills";
import { LevelDots } from "@/components/skills-list";
import { LevelProgressionChart, SkillRadarChart } from "./skills-charts";

export async function SkillsTab() {
  const skills = await getSkills(false);

  if (skills.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-edge bg-surface px-6 py-12 text-center text-sm text-muted">
        No skills yet — add some from Log → Skill.
      </p>
    );
  }

  const radar = skills
    .filter((s) => s.currentLevel !== null)
    .map((s) => ({
      skill: s.name,
      current: s.currentLevel!,
      target: s.targetLevel,
    }));

  const progression = skills
    .filter((s) => s.snapshots.length > 0)
    .map((s, i) => ({
      name: s.name,
      color: SKILL_SERIES[i % SKILL_SERIES.length],
      points: s.snapshots.map((sn) => ({
        label: format(new Date(sn.takenAt), "MMM yy"),
        level: sn.level,
      })),
    }));

  return (
    <div className="flex flex-col gap-5">
      <SkillRadarChart data={radar} />
      <LevelProgressionChart series={progression} />

      {/* The point of this page: what to do next, per skill. */}
      <section className="flex flex-col gap-2">
        <h2 className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Next actions
        </h2>
        {skills.map((s) => {
          const color = SKILL_CATEGORY_COLORS[s.category] ?? "#8a93a6";
          return (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-edge bg-surface px-3.5 py-3"
              style={{ borderLeft: `3px solid ${color}` }}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium" style={{ color }}>
                  {s.name}
                </p>
                <p className="mt-0.5 text-sm">
                  {s.nextAction ?? (
                    <span className="text-muted">no next action — set one in Library</span>
                  )}
                </p>
              </div>
              <LevelDots current={s.currentLevel} target={s.targetLevel} color={color} />
            </div>
          );
        })}
      </section>
    </div>
  );
}
