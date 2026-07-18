import { getSubjectsData } from "@/lib/queries";
import { SubjectsView } from "@/components/subjects-view";

export const dynamic = "force-dynamic";

export default async function SubjectsPage() {
  const subjects = await getSubjectsData();
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold">Subjects</h1>
      <SubjectsView subjects={subjects} />
    </div>
  );
}
