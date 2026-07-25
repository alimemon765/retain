import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  assertEncryptionKey,
  decryptSecret,
  encryptSecret,
  encryptionKeyValid,
  EncryptionKeyError,
} from "./crypto";

// 64 hex chars = 32 bytes, the shape `openssl rand -hex 32` produces.
// Test-only fixture — never a real key, so this file stays safe to commit.
const VALID_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const original = process.env.ENCRYPTION_KEY;

beforeEach(() => {
  process.env.ENCRYPTION_KEY = VALID_KEY;
});

afterEach(() => {
  if (original === undefined) delete process.env.ENCRYPTION_KEY;
  else process.env.ENCRYPTION_KEY = original;
});

describe("assertEncryptionKey", () => {
  it("accepts a 64-char hex key", () => {
    expect(() => assertEncryptionKey(VALID_KEY)).not.toThrow();
    expect(encryptionKeyValid()).toBe(true);
  });

  it("rejects a missing key with a usable message", () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => assertEncryptionKey()).toThrow(EncryptionKeyError);
    expect(() => assertEncryptionKey()).toThrow(/openssl rand -hex 32/);
    expect(() => assertEncryptionKey("")).toThrow(EncryptionKeyError);
  });

  it("rejects a key that is too short, saying how short", () => {
    expect(() => assertEncryptionKey("abcdef")).toThrow(/6 hex chars; 64 are required/);
  });

  it("rejects a key that is too long", () => {
    expect(() => assertEncryptionKey(VALID_KEY + "ab")).toThrow(/66 hex chars/);
  });

  it("rejects a non-hex key even at the right length", () => {
    const wrong = "z".repeat(64);
    expect(() => assertEncryptionKey(wrong)).toThrow(/hexadecimal only/);
  });

  it("reports invalid rather than throwing for UI state", () => {
    process.env.ENCRYPTION_KEY = "nope";
    expect(encryptionKeyValid()).toBe(false);
  });
});

describe("secret encryption", () => {
  it("round-trips a token", () => {
    const token = "1//0abcdefgh_refresh-token-value";
    expect(decryptSecret(encryptSecret(token))).toBe(token);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encryptSecret("same");
    const b = encryptSecret("same");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe(decryptSecret(b));
  });

  it("never stores the plaintext", () => {
    const stored = encryptSecret("super-secret");
    expect(stored).not.toContain("super-secret");
  });

  it("rejects tampering", () => {
    const stored = encryptSecret("value");
    const [iv, tag, data] = stored.split(":");
    const flipped = Buffer.from(data, "base64url");
    flipped[0] ^= 0xff;
    expect(() =>
      decryptSecret([iv, tag, flipped.toString("base64url")].join(":"))
    ).toThrow();
  });

  it("rejects malformed input", () => {
    expect(() => decryptSecret("nonsense")).toThrow("malformed secret");
  });

  it("refuses to encrypt with a bad key instead of using a weak one", () => {
    process.env.ENCRYPTION_KEY = "short";
    expect(() => encryptSecret("value")).toThrow(EncryptionKeyError);
  });

  it("cannot decrypt with a different key", () => {
    const stored = encryptSecret("value");
    process.env.ENCRYPTION_KEY =
      "0000000000000000000000000000000000000000000000000000000000000000";
    expect(() => decryptSecret(stored)).toThrow();
  });
});
