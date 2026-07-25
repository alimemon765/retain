import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM for the Google refresh token at rest. The key comes from
// ENCRYPTION_KEY; anything stored is "<iv>:<tag>:<ciphertext>" in base64url.

const ALGO = "aes-256-gcm";

/** AES-256 needs 32 bytes, which is what `openssl rand -hex 32` produces. */
export const ENCRYPTION_KEY_BYTES = 32;
const HEX_KEY = /^[0-9a-fA-F]{64}$/;

export class EncryptionKeyError extends Error {}

/**
 * Validate ENCRYPTION_KEY without using it. Called from instrumentation.ts so
 * a bad key fails at boot with a clear message, rather than at the moment the
 * user tries to connect Google Calendar.
 */
export function assertEncryptionKey(
  value: string | undefined = process.env.ENCRYPTION_KEY
): void {
  if (!value) {
    throw new EncryptionKeyError(
      "ENCRYPTION_KEY is not set. Generate one with: openssl rand -hex 32"
    );
  }
  if (!HEX_KEY.test(value)) {
    const hint = /^[0-9a-fA-F]+$/.test(value)
      ? `it is ${value.length} hex chars; ${ENCRYPTION_KEY_BYTES * 2} are required`
      : "it must be hexadecimal only";
    throw new EncryptionKeyError(
      `ENCRYPTION_KEY must be ${ENCRYPTION_KEY_BYTES * 2} hex characters ` +
        `(${ENCRYPTION_KEY_BYTES} bytes) — ${hint}. ` +
        "Generate one with: openssl rand -hex 32"
    );
  }
}

/** True when the key is present and well-formed — for UI state, never throws. */
export function encryptionKeyValid(): boolean {
  try {
    assertEncryptionKey();
    return true;
  } catch {
    return false;
  }
}

function key(): Buffer {
  assertEncryptionKey();
  // The key is validated hex, so use those bytes directly rather than hashing:
  // 64 hex chars already carry a full 256 bits of entropy.
  return Buffer.from(process.env.ENCRYPTION_KEY!, "hex");
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64url"),
    tag.toString("base64url"),
    enc.toString("base64url"),
  ].join(":");
}

export function decryptSecret(stored: string): string {
  const [ivB64, tagB64, dataB64] = stored.split(":");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("malformed secret");
  const decipher = createDecipheriv(
    ALGO,
    key(),
    Buffer.from(ivB64, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
