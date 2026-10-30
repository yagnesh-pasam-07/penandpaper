import "server-only";
import { and, count, desc, eq, isNull, or, lt, sql } from "drizzle-orm";
import { httpDb } from "@/db";
import { rateLimits, users } from "@/db/schema";
import type { User } from "@/server/session";
import { dropApiTokens } from "./schema";
import { LAST_USED_EVERY_MS, MAX_ACTIVE_TOKENS, TOKEN_SAVES_PER_MINUTE, generateToken, hashToken, tokenPreview } from "./tokens";

const db = httpDb;

export type TokenInfo = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

const iso = (d: Date | string | null): string | null => (d ? new Date(d).toISOString() : null);

/** Their tokens, newest first. Never the secret or its hash. */
export async function listApiTokens(userId: string): Promise<TokenInfo[]> {
  const rows = await db.select().from(dropApiTokens).where(eq(dropApiTokens.userId, userId)).orderBy(desc(dropApiTokens.createdAt));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    prefix: r.prefix,
    createdAt: iso(r.createdAt)!,
    lastUsedAt: iso(r.lastUsedAt),
    revokedAt: iso(r.revokedAt),
  }));
}

/** Makes a token. The secret comes back once, here; only its hash is stored. Null when they already hold the most allowed. */
export async function createApiToken(userId: string, name: string): Promise<{ secret: string; token: TokenInfo } | null> {
  const [{ active }] = await db
    .select({ active: count() })
    .from(dropApiTokens)
    .where(and(eq(dropApiTokens.userId, userId), isNull(dropApiTokens.revokedAt)));
  if (active >= MAX_ACTIVE_TOKENS) return null;
  const secret = generateToken();
  const [row] = await db
    .insert(dropApiTokens)
    .values({ userId, name, tokenHash: hashToken(secret), prefix: tokenPreview(secret) })
    .returning();
  return {
    secret,
    token: { id: row.id, name: row.name, prefix: row.prefix, createdAt: iso(row.createdAt)!, lastUsedAt: null, revokedAt: null },
  };
}

/** Stops a token working, at once. False if it isn't theirs or was already revoked. */
export async function revokeApiToken(userId: string, id: string): Promise<boolean> {
  const rows = await db
    .update(dropApiTokens)
    .set({ revokedAt: sql`now()` })
    .where(and(eq(dropApiTokens.id, id), eq(dropApiTokens.userId, userId), isNull(dropApiTokens.revokedAt)))
    .returning({ id: dropApiTokens.id });
  return rows.length > 0;
}

/**
 * Who a secret belongs to, or null for an unknown or revoked one. Notes when it
 * was used, at most once a minute so a busy app doesn't write on every save.
 */
export async function userFromToken(secret: string): Promise<{ user: User; tokenId: string } | null> {
  const [row] = await db
    .select({ tokenId: dropApiTokens.id, id: users.id, email: users.email, name: users.name, role: users.role })
    .from(dropApiTokens)
    .innerJoin(users, eq(users.id, dropApiTokens.userId))
    .where(and(eq(dropApiTokens.tokenHash, hashToken(secret)), isNull(dropApiTokens.revokedAt)));
  if (!row) return null;
  await db
    .update(dropApiTokens)
    .set({ lastUsedAt: sql`now()` })
    .where(
      and(
        eq(dropApiTokens.id, row.tokenId),
        or(isNull(dropApiTokens.lastUsedAt), lt(dropApiTokens.lastUsedAt, sql`now() - make_interval(secs => ${LAST_USED_EVERY_MS / 1000})`)),
      ),
    );
  return { user: { id: row.id, email: row.email, name: row.name, role: row.role }, tokenId: row.tokenId };
}

/**
 * One save by this token, counted in a one-minute window kept in the same
 * table Better Auth's limiter uses (so it holds across serverless instances).
 * False when the token is past its saves for the minute.
 */
export async function allowTokenSave(tokenId: string, now = Date.now()): Promise<boolean> {
  const key = `pp-token:${tokenId}`;
  const stale = now - 60_000;
  const [row] = await db
    .insert(rateLimits)
    .values({ key, count: 1, lastRequest: now })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.lastRequest} < ${stale} then 1 else ${rateLimits.count} + 1 end`,
        lastRequest: sql`case when ${rateLimits.lastRequest} < ${stale} then ${now} else ${rateLimits.lastRequest} end`,
      },
    })
    .returning({ count: rateLimits.count });
  return row.count <= TOKEN_SAVES_PER_MINUTE;
}
