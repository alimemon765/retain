import { getSkills } from "@/lib/queries-skills";
import { SkillsReviewFlow } from "@/components/skills-review-flow";

export const dynamic = "force-dynamic";

export default async function SkillsReviewPage() {
  const skills = await getSkills(false);
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold">Quarterly skill review</h1>
        <p className="mt-1 text-sm text-muted">
          For each skill: where are you honestly, and what&apos;s the one next
          step? This is the only time levels change.
        </p>
      </div>
      <SkillsReviewFlow
        skills={skills.map((s) => ({
          id: s.id,
          name: s.name,
          category: s.category,
          currentLevel: s.currentLevel,
          targetLevel: s.targetLevel,
          nextAction: s.nextAction,
        }))}
      />
    </div>
  );
}
