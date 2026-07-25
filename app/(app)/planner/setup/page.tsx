import Link from "next/link";
import { getClassSlots, getPlannerSettings } from "@/lib/queries-planner";
import { gcalConfigured } from "@/lib/gcal";
import { PlannerSettingsForm } from "@/components/planner/settings-form";
import { TimetableEditor } from "@/components/planner/timetable-editor";
import { GcalPanel } from "@/components/planner/gcal-panel";

export const dynamic = "force-dynamic";

export default async function PlannerSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ gcal?: string }>;
}) {
  const [{ gcal }, settings, slots] = await Promise.all([
    searchParams,
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
      <GcalPanel
        connected={settings.gcalConnected}
        configured={gcalConfigured()}
        syncClasses={settings.gcalSyncClasses}
        lastSyncAt={settings.gcalLastSyncAt}
        status={gcal}
      />
    </div>
  );
}
