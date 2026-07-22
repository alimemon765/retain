import { TabBar, type TabDef } from "@/components/tab-bar";
import { StudyTab } from "@/components/progress/study-tab";
import { DsaTab } from "@/components/progress/dsa-tab";
import { BooksTab } from "@/components/progress/books-tab";
import { SkillsTab } from "@/components/progress/skills-tab";

export const dynamic = "force-dynamic";

const TABS: TabDef[] = [
  { key: "study", label: "Study" },
  { key: "dsa", label: "DSA" },
  { key: "books", label: "Books" },
  { key: "skills", label: "Skills" },
];

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const active = TABS.some((t) => t.key === tab) ? tab! : "study";

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold">Progress</h1>
      <TabBar basePath="/progress" tabs={TABS} active={active} />
      {active === "study" && <StudyTab />}
      {active === "dsa" && <DsaTab />}
      {active === "books" && <BooksTab />}
      {active === "skills" && <SkillsTab />}
    </div>
  );
}
