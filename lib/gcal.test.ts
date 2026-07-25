import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  authUrl,
  gcalPanelState,
  isAuthExpiredResponse,
  redirectUri,
} from "./gcal";

const saved = { ...process.env };

beforeEach(() => {
  process.env.GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";
  process.env.APP_URL = "https://retain-delta.vercel.app";
});

afterEach(() => {
  process.env = { ...saved };
});

describe("isAuthExpiredResponse", () => {
  // Google returns invalid_grant when the refresh token is revoked or expired.
  it("treats invalid_grant as an expired grant", () => {
    expect(isAuthExpiredResponse(400, { error: "invalid_grant" })).toBe(true);
  });

  it("treats 401 as an expired grant", () => {
    expect(isAuthExpiredResponse(401, null)).toBe(true);
  });

  it("does not mistake transient failures for expiry", () => {
    // These deserve a retry, not a reconnect prompt.
    expect(isAuthExpiredResponse(500, { error: "internal_failure" })).toBe(false);
    expect(isAuthExpiredResponse(429, { error: "rateLimitExceeded" })).toBe(false);
    expect(isAuthExpiredResponse(503, null)).toBe(false);
  });

  it("does not treat a config error as expiry", () => {
    // A wrong client secret is a deploy problem; reconnecting will not fix it.
    expect(isAuthExpiredResponse(400, { error: "invalid_client" })).toBe(false);
  });
});

describe("gcalPanelState", () => {
  it("asks for reconnect when the grant expired", () => {
    expect(
      gcalPanelState({ configured: true, connected: true, authExpired: true })
    ).toBe("RECONNECT");
  });

  it("shows connected while the grant is healthy", () => {
    expect(
      gcalPanelState({ configured: true, connected: true, authExpired: false })
    ).toBe("CONNECTED");
  });

  it("shows connect (not reconnect) when never connected", () => {
    expect(
      gcalPanelState({ configured: true, connected: false, authExpired: false })
    ).toBe("DISCONNECTED");
  });

  it("reports missing configuration ahead of everything else", () => {
    expect(
      gcalPanelState({ configured: false, connected: true, authExpired: true })
    ).toBe("NOT_CONFIGURED");
  });
});

describe("redirect URI", () => {
  it("is built from APP_URL and must match the registered one exactly", () => {
    expect(redirectUri()).toBe(
      "https://retain-delta.vercel.app/api/gcal/callback"
    );
  });

  it("tolerates a trailing slash on APP_URL", () => {
    process.env.APP_URL = "https://retain-delta.vercel.app/";
    expect(redirectUri()).toBe(
      "https://retain-delta.vercel.app/api/gcal/callback"
    );
  });

  it("falls back to localhost when APP_URL is unset", () => {
    delete process.env.APP_URL;
    expect(redirectUri()).toBe("http://localhost:3000/api/gcal/callback");
  });
});

describe("authUrl", () => {
  it("requests offline access so a refresh token is actually issued", () => {
    const url = new URL(authUrl("nonce-123"));
    expect(url.origin + url.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth"
    );
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("state")).toBe("nonce-123");
    expect(url.searchParams.get("scope")).toBe(
      "https://www.googleapis.com/auth/calendar"
    );
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://retain-delta.vercel.app/api/gcal/callback"
    );
  });
});
