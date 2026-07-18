import { addDays, startOfDay } from "date-fns";

// All scheduling uses date-only semantics: a "day" is local midnight to local
// midnight (Asia/Kolkata in production — the server runs in the user's tz).

export function today(): Date {
  return startOfDay(new Date());
}

export function localDay(d: Date): Date {
  return startOfDay(d);
}

export function dayPlus(d: Date, days: number): Date {
  return startOfDay(addDays(d, days));
}

/** Stable yyyy-MM-dd key for grouping by local day. */
export function dayKey(d: Date): string {
  const day = startOfDay(d);
  const y = day.getFullYear();
  const m = String(day.getMonth() + 1).padStart(2, "0");
  const dd = String(day.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
