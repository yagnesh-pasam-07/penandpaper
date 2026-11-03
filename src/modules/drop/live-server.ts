import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { httpDb as db } from "@/db";
import { users } from "@/db/schema";
import { env } from "@/lib/env";
import { channelOf, wire, type Envelope, type LiveEvent, type Peer } from "./live";
import type { Thought } from "./logic";
import { dropPapers, dropShares } from "./schema";

/**
 * The server half of a live paper. Each save calls `broadcast`, a NOTIFY on the
 * paper's channel; each open paper's stream LISTENs on it (see the live route).
 * A failed broadcast never fails the save: the others catch up when they next sync.
 */
export async function broadcast(paperId: string, ev: LiveEvent, by?: string | null): Promise<void> {
  try {
    await db.execute(sql`select pg_notify(${channelOf(paperId)}, ${wire({ ...ev, by: by ?? undefined } as Envelope)})`);
  } catch (e) {
    console.error("live: broadcast failed", e);
  }
}

/** A thought as the others get it. Due dates go to the owner's other screens only: each stream strips them for everyone else. */
export function thoughtEvent(t: Thought): LiveEvent {
  return { type: "thought", thought: t };
}

/** The tab that made a change (sent by the browser on every save), so it skips its own echo. */
export function tabOf(request: Request): string | null {
  const v = request.headers.get("x-pp-tab");
  return v && /^[a-z0-9-]{6,40}$/.test(v) ? v : null;
}

export type Access = { role: "owner" | "edit" | "view"; ownerId: string };

/**
 * What this person may do on this paper: the owner, someone it's shared with
 * (by their signed-in email, with that share's role), or anyone holding the
 * public link while it's on (view). Null: nothing.
 */
export async function accessTo(paperId: string, who: { id: string; email: string } | null, token?: string | null): Promise<Access | null> {
  const [p] = await db
    .select({ ownerId: dropPapers.userId, publicToken: dropPapers.publicToken })
    .from(dropPapers)
    .where(and(eq(dropPapers.id, paperId), isNull(dropPapers.deletedAt)));
  if (!p) return null;
  if (who && p.ownerId === who.id) return { role: "owner", ownerId: p.ownerId };
  if (who) {
    const [s] = await db
      .select({ role: dropShares.role })
      .from(dropShares)
      .where(and(eq(dropShares.paperId, paperId), eq(dropShares.email, who.email.toLowerCase())));
    if (s) return { role: s.role === "edit" ? "edit" : "view", ownerId: p.ownerId };
  }
  if (token && p.publicToken && token.length === p.publicToken.length && timingSafeEqual(Buffer.from(token), Buffer.from(p.publicToken))) return { role: "view", ownerId: p.ownerId };
  return null;
}

/** A person's first name for their cursor; never their email. */
export async function firstName(userId: string): Promise<string> {
  const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));
  return u?.name?.trim().split(/\s+/)[0] || "Someone";
}

/**
 * A short-lived key the stream hands its tab, so pointer moves (many a second)
 * are checked by a signature instead of a database read. Tied to the paper,
 * the tab and the person; good for 10 minutes (a stream lives 5, then renews it).
 */
const KEY_MS = 10 * 60_000;
const sign = (body: string) => createHmac("sha256", env.BETTER_AUTH_SECRET).update(`live:${body}`).digest("base64url");

export function liveKey(paperId: string, peer: Peer, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ p: paperId, peer, exp: now + KEY_MS })).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function readKey(paperId: string, key: string, now = Date.now()): Peer | null {
  const [body, mac] = key.split(".");
  if (!body || !mac) return null;
  const want = sign(body);
  if (mac.length !== want.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(want))) return null;
  try {
    const v = JSON.parse(Buffer.from(body, "base64url").toString()) as { p: string; peer: Peer; exp: number };
    return v.p === paperId && v.exp > now ? v.peer : null;
  } catch {
    return null;
  }
}

/** The connection a stream LISTENs on: the direct one (a pooled connection drops a LISTEN between queries). */
export function listenUrl(): string {
  return env.DATABASE_URL_UNPOOLED ?? env.DATABASE_URL.replace("-pooler.", ".");
}
