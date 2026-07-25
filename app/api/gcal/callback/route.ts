import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { ensureCalendar, exchangeCode, saveRefreshToken } from "@/lib/gcal";

export const dynamic = "force-dynamic";

function back(req: NextRequest, status: string) {
  const url = new URL("/planner/setup", req.nextUrl.origin);
  url.searchParams.set("gcal", status);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");
  if (error) return back(req, "denied");
  if (!code || !state) return back(req, "invalid");

  const store = await cookies();
  if (store.get("gcal_state")?.value !== state) return back(req, "state");
  store.delete("gcal_state");

  const tokens = await exchangeCode(code);
  if (!tokens.refresh_token) {
    // Google only returns a refresh token on first consent; prompt=consent
    // should force one, so this means something went wrong.
    return back(req, "no_refresh_token");
  }

  await saveRefreshToken(tokens.refresh_token);
  try {
    await ensureCalendar();
  } catch {
    return back(req, "calendar_failed");
  }
  return back(req, "connected");
}
