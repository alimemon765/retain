import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { authUrl, gcalConfigured } from "@/lib/gcal";

export const dynamic = "force-dynamic";

/** Kick off the Google consent flow. PIN-protected by proxy.ts like everything else. */
export async function GET() {
  if (!gcalConfigured()) {
    return NextResponse.json(
      { error: "Google Calendar env vars are not set" },
      { status: 400 }
    );
  }
  // CSRF: round-trip a nonce through Google and compare on the way back.
  const state = randomBytes(16).toString("base64url");
  const store = await cookies();
  store.set("gcal_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  return NextResponse.redirect(authUrl(state));
}
