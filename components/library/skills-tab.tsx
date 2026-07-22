import { getSkills } from "@/lib/queries-skills";
import { SkillsList } from "@/components/skills-list";

export async function SkillsTab() {
  const skills = await getSkills(true); // archived shown dimmed at the bottom
  const sorted = [...skills.filter((s) => !s.archived), ...skills.filter((s) => s.archived)];
  return <SkillsList skills={sorted} />;
}
