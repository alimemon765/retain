import { SettingsView } from "@/components/settings-view";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold">Settings</h1>
      <SettingsView
        vapidConfigured={Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)}
      />
    </div>
  );
}
