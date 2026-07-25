/**
 * Runs once when the server starts, before any request is handled.
 *
 * Config that would otherwise blow up mid-flow gets checked here instead, so a
 * bad ENCRYPTION_KEY is a boot failure with a clear message rather than an
 * error the first time I try to connect Google Calendar.
 */
export async function register() {
  // Only relevant on the Node runtime; the edge/proxy runtime has no crypto key use.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { assertEncryptionKey } = await import("./lib/crypto");

  const hasKey = Boolean(process.env.ENCRYPTION_KEY);
  const hasGoogle = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );

  if (hasGoogle && !hasKey) {
    throw new Error(
      "Google Calendar is configured but ENCRYPTION_KEY is missing — the " +
        "refresh token could not be stored safely. Generate one with: " +
        "openssl rand -hex 32"
    );
  }

  // A malformed key is always fatal: it is either wrong now or wrong later.
  if (hasKey) {
    assertEncryptionKey();
  }
}
