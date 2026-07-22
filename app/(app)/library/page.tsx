import { TabBar, type TabDef } from "@/components/tab-bar";
import { SubjectsTab } from "@/components/library/subjects-tab";
import { ProblemsTab } from "@/components/library/problems-tab";
import { ComingSoon } from "@/components/coming-soon";

export const dynamic = "force-dynamic";

const TABS: TabDef[] = [
  { key: "subjects", label: "Subjects & Topics" },
  { key: "problems", label: "Problems" },
  { key: "books", label: "Books" },
  { key: "skills", label: "Skills" },
];

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const active = TABS.some((t) => t.key === tab) ? tab! : "subjects";

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold">Library</h1>
      <TabBar basePath="/library" tabs={TABS} active={active} />
      {active === "subjects" && <SubjectsTab />}
      {active === "problems" && <ProblemsTab />}
      {active === "books" && <ComingSoon label="Books" />}
      {active === "skills" && <ComingSoon label="Skills" />}
    </div>
  );
}
