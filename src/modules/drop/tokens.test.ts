import { describe, expect, it } from "vitest";
import { MAX_TOKEN_NAME, TOKEN_PREFIX, bearerToken, cleanTokenName, generateToken, hashToken, tokenPreview } from "./tokens";

describe("personal access tokens", () => {
  it("makes pp_ secrets from 32 random bytes, URL-safe and different each time", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).toMatch(/^pp_[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });

  it("stores a SHA-256 of the secret, not the secret", () => {
    const secret = "pp_example-secret-value-1234567890abcdefghij";
    const hash = hashToken(secret);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashToken(secret));
    expect(hash).not.toContain(secret);
    expect(hashToken(`${secret}x`)).not.toBe(hash);
  });

  it("shows only the start of a secret in lists", () => {
    const secret = generateToken();
    expect(tokenPreview(secret)).toBe(secret.slice(0, TOKEN_PREFIX.length + 5));
    expect(tokenPreview(secret).length).toBeLessThan(12);
  });

  it("reads a token only from `Authorization: Bearer pp_…`", () => {
    const secret = generateToken();
    expect(bearerToken(`Bearer ${secret}`)).toBe(secret);
    expect(bearerToken(` Bearer ${secret} `)).toBe(secret);
    expect(bearerToken(secret)).toBeNull();
    expect(bearerToken(`Basic ${secret}`)).toBeNull();
    expect(bearerToken(`Bearer sk_${secret.slice(3)}`)).toBeNull();
    expect(bearerToken("Bearer pp_short")).toBeNull();
    expect(bearerToken(`Bearer ${secret} extra`)).toBeNull();
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken("")).toBeNull();
  });

  it("cleans a token's name to one trimmed line", () => {
    expect(cleanTokenName("  Mac   app \n")).toBe("Mac app");
    expect(cleanTokenName("x".repeat(MAX_TOKEN_NAME + 10))).toHaveLength(MAX_TOKEN_NAME);
    expect(cleanTokenName("   ")).toBeNull();
    expect(cleanTokenName(42)).toBeNull();
  });
});
