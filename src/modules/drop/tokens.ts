import { createHash, randomBytes } from "node:crypto";

/** Every personal access token starts with this, so a leaked one is easy to spot and revoke. */
export const TOKEN_PREFIX = "pp_";
/** A person can hold this many un-revoked tokens at once. */
export const MAX_ACTIVE_TOKENS = 5;
/** Saves allowed per token per minute. */
export const TOKEN_SAVES_PER_MINUTE = 60;
/** A token's `last_used_at` is written at most this often, so a busy app doesn't write on every save. */
export const LAST_USED_EVERY_MS = 60_000;
export const MAX_TOKEN_NAME = 40;

/** A new secret: `pp_` plus 32 random bytes, URL-safe. It is shown once and only its hash is kept. */
export function generateToken(): string {
  return `${TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
}

/** What's stored for a secret: its SHA-256, hex. The secret itself is never kept. */
export function hashToken(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

/** The start of a secret, safe to show in a list so a person can tell their tokens apart. */
export function tokenPreview(secret: string): string {
  return secret.slice(0, TOKEN_PREFIX.length + 5);
}

/** A token's name as typed: trimmed, one line, and not empty. */
export function cleanTokenName(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const one = name.replace(/\s+/g, " ").trim().slice(0, MAX_TOKEN_NAME);
  return one || null;
}

/** The secret in `Authorization: Bearer pp_…`, or null. Only this header form counts; a token in a URL is never read. */
export function bearerToken(header: string | null | undefined): string | null {
  const match = /^Bearer (pp_[A-Za-z0-9_-]{20,128})$/.exec(header?.trim() ?? "");
  return match ? match[1] : null;
}
