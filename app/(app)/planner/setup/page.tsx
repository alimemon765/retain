import Link from "next/link";
import { getClassSlots, getPlannerSettings } from "@/lib/queries-planner";
import { PlannerSettingsForm } from "@/components/planner/settings-form";
import { TimetableEditor } from "@/components/planner/timetable-editor";

export const dynamic = "force-dynamic";

export default async function PlannerSetupPage() {
  const [settings, slots] = await Promise.all([
    getPlannerSettings(),
    getClassSlots(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Planner setup</h1>
        <Link href="/planner" className="text-sm text-accent underline">
          done
        </Link>
      </div>

      <TimetableEditor slots={slots} />
      <PlannerSettingsForm settings={settings} />
    </div>
  );
}
