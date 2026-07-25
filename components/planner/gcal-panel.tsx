"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { disconnectCalendar, syncToCalendar } from "@/app/gcal-actions";
import { updatePlannerSettings } from "@/app/planner-actions";

export function GcalPanel({
  connected,
  configured,
  syncClasses,
  lastSyncAt,
  status,
}: {
  connected: boolean;
  configured: boolean;
  syncClasses: boolean;
  lastSyncAt: Date | null;
  status?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [reconnect, setReconnect] = useState(false);

  async function sync() {
    setBusy(true);
    setNote(null);
    try {
      const r = await syncToCalendar();
      setNote(r.message);
      setReconnect(Boolean(r.needsReconnect));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const statusMessage: Record<string, string> = {
    connected: "Connected. Your plan will appear in the Retain calendar.",
    denied: "Google access was declined.",
    state: "Security check failed — try connecting again.",
    no_refresh_token: "Google didn't return a refresh token. Try again.",
    calendar_failed: "Connected, but creating the Retain calendar failed.",
    invalid: "That callback was missing information.",
  };

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-edge bg-surface p-3.5">
      <div>
        <h2 className="font-medium">Google Calendar</h2>
        <p className="mt-1 text-xs text-muted">
          Retain writes work blocks to a separate calendar named{" "}
          <span className="text-foreground">Retain</span> — never your primary
          one. Add Google Calendar&apos;s home-screen widget and each block
          announces itself when it starts.
        </p>
      </div>

      {status && statusMessage[status] && (
        <p
          className={`rounded-lg px-3 py-2 text-xs ${
            status === "connected" ? "bg-good/10 text-good" : "bg-again/10 text-again"
          }`}
        >
          {statusMessage[status]}
        </p>
      )}

      {!configured ? (
        <p className="text-sm text-again">
          Not configured — set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and
          ENCRYPTION_KEY, then redeploy. See README.
        </p>
      ) : !connected || reconnect ? (
        <a
          href="/api/gcal/auth"
          className="self-start rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-background"
        >
          {reconnect ? "Reconnect Google Calendar" : "Connect Google Calendar"}
        </a>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-good">Connected</span>
            <button
              type="button"
              onClick={sync}
              disabled={busy}
              className="rounded-lg border border-edge px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {busy ? "Syncing…" : "Sync now"}
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!confirm("Disconnect Google Calendar?")) return;
                await disconnectCalendar();
                router.refresh();
              }}
              className="text-[11px] text-muted underline"
            >
              disconnect
            </button>
          </div>

          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={syncClasses}
              onChange={async (e) => {
                await updatePlannerSettings({ gcalSyncClasses: e.target.checked });
                router.refresh();
              }}
              className="accent-[color:var(--accent)]"
            />
            Also put classes on the calendar (so the widget shows the full day)
          </label>

          <p className="text-[11px] text-muted">
            {lastSyncAt
              ? `Last synced ${format(new Date(lastSyncAt), "d MMM, HH:mm")}`
              : "Not synced yet."}
          </p>
        </>
      )}

      {note && <p className="text-xs text-muted">{note}</p>}
    </section>
  );
}
