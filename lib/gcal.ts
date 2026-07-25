import { prisma } from "./db";
import { decryptSecret, encryptSecret } from "./crypto";

// Google Calendar is the output layer: its widget is the home-screen widget
// and its event notifications are the block-start reminders. We talk to the
// REST API directly rather than pulling in the full googleapis SDK.

const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const OAUTH_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const CAL_API = "https://www.googleapis.com/calendar/v3";
export const GCAL_SCOPE = "https://www.googleapis.com/auth/calendar";
export const RETAIN_CALENDAR_NAME = "Retain";
const TIME_ZONE = "Asia/Kolkata";

/** Kinds worth putting on the calendar. Sleep/travel/meals would just be noise. */
const SYNCED_KINDS = ["REVISION", "DSA", "READING", "SKILL", "CUSTOM"];

export class GcalNotConnected extends Error {
  constructor() {
    super("Google Calendar is not connected");
  }
}

export class GcalAuthExpired extends Error {
  constructor() {
    super("Google Calendar authorisation expired — reconnect");
  }
}

export function gcalConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.ENCRYPTION_KEY
  );
}

export function redirectUri(): string {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/gcal/callback`;
}

export function authUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: GCAL_SCOPE,
    // offline + consent is what actually yields a refresh token.
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${OAUTH_AUTH_URL}?${params}`;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
}

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  return (await res.json()) as TokenResponse;
}

/** Exchange the stored refresh token for a short-lived access token. */
async function accessToken(): Promise<string> {
  const settings = await prisma.plannerSettings.findUnique({
    where: { id: "singleton" },
    select: { gcalRefreshToken: true },
  });
  if (!settings?.gcalRefreshToken) throw new GcalNotConnected();

  const refresh = decryptSecret(settings.gcalRefreshToken);
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refresh,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  const data = (await res.json()) as TokenResponse;
  if (!res.ok || !data.access_token) {
    // A revoked or expired grant is a reconnect prompt, not a silent failure.
    if (data.error === "invalid_grant") throw new GcalAuthExpired();
    throw new Error(`Google token refresh failed: ${data.error ?? res.status}`);
  }
  return data.access_token;
}

async function api<T>(
  path: string,
  init: RequestInit & { token: string }
): Promise<T> {
  const { token, ...rest } = init;
  const res = await fetch(`${CAL_API}${path}`, {
    ...rest,
    headers: {
      ...(rest.headers ?? {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (res.status === 401) throw new GcalAuthExpired();
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Calendar ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export async function saveRefreshToken(token: string) {
  await prisma.plannerSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", gcalRefreshToken: encryptSecret(token) },
    update: { gcalRefreshToken: encryptSecret(token) },
  });
}

export async function disconnect() {
  await prisma.plannerSettings.update({
    where: { id: "singleton" },
    data: { gcalRefreshToken: null, gcalCalendarId: null, gcalLastSyncAt: null },
  });
  await prisma.plannedBlock.updateMany({ data: { gcalEventId: null } });
}

/**
 * Find or create the dedicated "Retain" calendar. We never write to the
 * primary calendar: one toggle hides all of this, and a sync bug can never
 * touch real appointments.
 */
export async function ensureCalendar(): Promise<string> {
  const settings = await prisma.plannerSettings.findUnique({
    where: { id: "singleton" },
    select: { gcalCalendarId: true },
  });
  if (settings?.gcalCalendarId) return settings.gcalCalendarId;

  const token = await accessToken();
  const list = await api<{ items?: { id: string; summary: string }[] }>(
    "/users/me/calendarList",
    { token, method: "GET" }
  );
  const existing = list.items?.find((c) => c.summary === RETAIN_CALENDAR_NAME);

  const id =
    existing?.id ??
    (
      await api<{ id: string }>("/calendars", {
        token,
        method: "POST",
        body: JSON.stringify({
          summary: RETAIN_CALENDAR_NAME,
          description: "Auto-generated study plan from Retain.",
          timeZone: TIME_ZONE,
        }),
      })
    ).id;

  await prisma.plannerSettings.update({
    where: { id: "singleton" },
    data: { gcalCalendarId: id },
  });
  return id;
}

function eventTimes(date: Date, hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  // 24:00 is our end-of-day marker; Google needs it as 23:59.
  const hh = String(Math.min(h, 23)).padStart(2, "0");
  const mm = String(h >= 24 ? 59 : m).padStart(2, "0");
  return {
    dateTime: `${y}-${mo}-${d}T${hh}:${mm}:00`,
    timeZone: TIME_ZONE,
  };
}

interface BlockForSync {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  kind: string;
  title: string;
  topicIds: string[];
  problemIds: string[];
  gcalEventId: string | null;
}

function eventBody(block: BlockForSync, appUrl: string) {
  const parts: string[] = [];
  if (block.topicIds.length) parts.push(`${block.topicIds.length} topics`);
  if (block.problemIds.length) parts.push(`${block.problemIds.length} problems`);
  parts.push(`Open Retain: ${appUrl}/planner`);
  return {
    summary: block.title,
    description: parts.join("\n"),
    start: eventTimes(block.date, block.startTime),
    end: eventTimes(block.date, block.endTime),
    // A popup at 0 minutes is what makes the phone announce the block start.
    reminders: {
      useDefault: false,
      overrides: [{ method: "popup", minutes: 0 }],
    },
  };
}

export interface SyncResult {
  created: number;
  updated: number;
  deleted: number;
  skipped: number;
}

/**
 * Push a day's work blocks to the Retain calendar, patching existing events
 * rather than clearing and recreating — recreating spams notifications and
 * throws away the event history.
 */
export async function syncDay(date: Date): Promise<SyncResult> {
  if (!gcalConfigured()) throw new GcalNotConnected();
  const token = await accessToken();
  const calendarId = await ensureCalendar();
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  const settings = await prisma.plannerSettings.findUnique({
    where: { id: "singleton" },
    select: { gcalSyncClasses: true },
  });
  const kinds = settings?.gcalSyncClasses
    ? [...SYNCED_KINDS, "CLASS"]
    : SYNCED_KINDS;

  const blocks = await prisma.plannedBlock.findMany({ where: { date } });
  const result: SyncResult = { created: 0, updated: 0, deleted: 0, skipped: 0 };

  for (const b of blocks) {
    const shouldSync = kinds.includes(b.kind);

    if (!shouldSync) {
      // Was synced before but no longer qualifies (e.g. classes toggled off).
      if (b.gcalEventId) {
        await api(`/calendars/${encodeURIComponent(calendarId)}/events/${b.gcalEventId}`, {
          token,
          method: "DELETE",
        }).catch(() => undefined);
        await prisma.plannedBlock.update({
          where: { id: b.id },
          data: { gcalEventId: null },
        });
        result.deleted++;
      } else {
        result.skipped++;
      }
      continue;
    }

    const body = eventBody(b as BlockForSync, appUrl);
    if (b.gcalEventId) {
      try {
        await api(
          `/calendars/${encodeURIComponent(calendarId)}/events/${b.gcalEventId}`,
          { token, method: "PATCH", body: JSON.stringify(body) }
        );
        result.updated++;
        continue;
      } catch {
        // Event was deleted in Google — fall through and recreate it.
      }
    }
    const created = await api<{ id: string }>(
      `/calendars/${encodeURIComponent(calendarId)}/events`,
      { token, method: "POST", body: JSON.stringify(body) }
    );
    await prisma.plannedBlock.update({
      where: { id: b.id },
      data: { gcalEventId: created.id },
    });
    result.created++;
  }

  await prisma.plannerSettings.update({
    where: { id: "singleton" },
    data: { gcalLastSyncAt: new Date() },
  });
  return result;
}

/**
 * Remove calendar events for blocks that are being deleted, so a regenerated
 * day does not leave orphaned events behind. Best-effort and never throws:
 * losing a stale event is not worth failing the user's action over.
 */
export async function deleteEvents(eventIds: string[]): Promise<number> {
  const ids = eventIds.filter(Boolean);
  if (ids.length === 0 || !gcalConfigured()) return 0;
  try {
    const token = await accessToken();
    const calendarId = await ensureCalendar();
    let deleted = 0;
    for (const id of ids) {
      try {
        await api(
          `/calendars/${encodeURIComponent(calendarId)}/events/${id}`,
          { token, method: "DELETE" }
        );
        deleted++;
      } catch {
        // Already gone in Google — nothing to do.
      }
    }
    return deleted;
  } catch {
    return 0;
  }
}

export { SYNCED_KINDS };
