import { getSubjectsData } from "@/lib/queries";
import { SubjectsView } from "@/components/subjects-view";

export async function SubjectsTab() {
  const subjects = await getSubjectsData();
  return <SubjectsView subjects={subjects} />;
}
