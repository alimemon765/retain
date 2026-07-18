// Single-user PIN lock. The auth cookie holds sha256("retain:" + PIN); works
// in both the edge runtime (proxy.ts) and node (server actions).

export const AUTH_COOKIE = "retain_auth";
export const AUTH_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function authToken(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`retain:${pin}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
