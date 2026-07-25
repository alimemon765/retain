import { beforeAll, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./crypto";

beforeAll(() => {
  process.env.ENCRYPTION_KEY = "test-key-for-unit-tests";
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
});
