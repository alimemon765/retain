import { prisma } from "@/lib/db";
import { LogForm } from "@/components/log-form";

export const dynamic = "force-dynamic";

export default async function LogPage() {
  const subjects = await prisma.subject.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, color: true },
  });
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold">Log a topic</h1>
      <LogForm subjects={subjects} />
    </div>
  );
}
