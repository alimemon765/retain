import { prisma } from "@/lib/db";
import { getAllPatterns } from "@/lib/queries-dsa";
import { LogTabs } from "@/components/log-tabs";

export const dynamic = "force-dynamic";

export default async function LogPage() {
  const [subjects, patterns] = await Promise.all([
    prisma.subject.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
    getAllPatterns(),
  ]);
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold">Log</h1>
      <LogTabs subjects={subjects} patterns={patterns} />
    </div>
  );
}
