"use server";

import { revalidatePath } from "next/cache";
import { localDay, today } from "@/lib/dates";
import {
  GcalAuthExpired,
  GcalNotConnected,
  disconnect,
  syncDay,
} from "@/lib/gcal";

export interface SyncOutcome {
  ok: boolean;
  message: string;
  needsReconnect?: boolean;
}

/** Push a day's plan to the Retain calendar. Surfaces auth failure explicitly. */
export async function syncToCalendar(dateISO?: string): Promise<SyncOutcome> {
  const date = dateISO ? localDay(new Date(`${dateISO}T00:00:00`)) : today();
  try {
    const r = await syncDay(date);
    revalidatePath("/planner");
    revalidatePath("/planner/setup");
    return {
      ok: true,
      message: `Synced — ${r.created} added, ${r.updated} updated${
        r.deleted ? `, ${r.deleted} removed` : ""
      }.`,
    };
  } catch (e) {
    if (e instanceof GcalNotConnected) {
      return { ok: false, message: "Google Calendar isn't connected yet." };
    }
    if (e instanceof GcalAuthExpired) {
      return {
        ok: false,
        needsReconnect: true,
        message: "Google access expired — reconnect to keep syncing.",
      };
    }
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Sync failed.",
    };
  }
}

export async function disconnectCalendar() {
  await disconnect();
  revalidatePath("/planner/setup");
}
