import { getAllPatterns, getProblemsForLibrary } from "@/lib/queries-dsa";
import { ProblemsList } from "@/components/problems-list";

export async function ProblemsTab() {
  const [problems, patterns] = await Promise.all([
    getProblemsForLibrary(),
    getAllPatterns(),
  ]);
  return <ProblemsList problems={problems} patterns={patterns} />;
}
