import Link from "next/link";
import { getClassSlots } from "@/lib/queries-planner";

export const dynamic = "force-dynamic";

export default async function PlannerPage() {
  const slots = await getClassSlots();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Plan</h1>
        <Link href="/planner/setup" className="text-sm text-accent underline">
          setup
        </Link>
      </div>
      <p className="rounded-xl border border-dashed border-edge bg-surface px-6 py-12 text-center text-sm text-muted">
        {slots.length === 0
          ? "Add your timetable in setup to start planning days."
          : `Timetable ready (${slots.length} classes). Day view lands next.`}
      </p>
    </div>
  );
}
