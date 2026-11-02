import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, eq, isNull } from "drizzle-orm";
import { httpDb } from "@/db";
import { getPaper } from "./server";
import type { DropPaper } from "./logic";
import { dropPapers, dropShares } from "./schema";

const db = httpDb;

/**
 * Sharing a paper, read-only, two ways:
 * - by email: that person signs in with that address and can view it;
 * - anyone with the link: `/p/<token>`, a random 128-bit token (never the
 *   paper id), off by default, killed the moment it's turned off.
 * Every read checks the share on the server, so a change takes effect on the next request.
 */

export type ShareState = { people: { email: string; createdAt: string }[]; publicToken: string | null };

async function owned(userId: string, paperId: string) {
  const [p] = await db
    .select({ id: dropPapers.id, name: dropPapers.name, publicToken: dropPapers.publicToken })
    .from(dropPapers)
    .where(and(eq(dropPapers.id, paperId), eq(dropPapers.userId, userId), isNull(dropPapers.deletedAt)));
  return p ?? null;
}

export async function shareState(userId: string, paperId: string): Promise<ShareState | null> {
  const p = await owned(userId, paperId);
  if (!p) return null;
  const people = await db.select({ email: dropShares.email, createdAt: dropShares.createdAt }).from(dropShares).where(eq(dropShares.paperId, paperId)).orderBy(asc(dropShares.createdAt));
  return { people: people.map((r) => ({ email: r.email, createdAt: new Date(r.createdAt).toISOString() })), publicToken: p.publicToken };
}

/** Adds a person; false if the paper isn't theirs. Returns whether they were new (so the email goes once). */
export async function invite(userId: string, paperId: string, email: string): Promise<{ ok: boolean; added: boolean; name: string | null }> {
  const p = await owned(userId, paperId);
  if (!p) return { ok: false, added: false, name: null };
  const rows = await db.insert(dropShares).values({ paperId, email: email.toLowerCase(), invitedBy: userId }).onConflictDoNothing().returning({ id: dropShares.id });
  return { ok: true, added: rows.length > 0, name: p.name };
}

export async function uninvite(userId: string, paperId: string, email: string): Promise<boolean> {
  if (!(await owned(userId, paperId))) return false;
  await db.delete(dropShares).where(and(eq(dropShares.paperId, paperId), eq(dropShares.email, email.toLowerCase())));
  return true;
}

/** Turns the public link on (a new token if `fresh` or none yet) or off. Returns the token, or null when off. */
export async function setPublicLink(userId: string, paperId: string, on: boolean, fresh = false): Promise<string | null | undefined> {
  const p = await owned(userId, paperId);
  if (!p) return undefined;
  const token = on ? (fresh || !p.publicToken ? randomBytes(16).toString("base64url") : p.publicToken) : null;
  await db.update(dropPapers).set({ publicToken: token }).where(eq(dropPapers.id, paperId));
  return token;
}

/** The view a shared reader gets: thoughts and lines, nothing about the owner. */
export type SharedPaper = Pick<DropPaper, "id" | "name" | "createdAt" | "thoughts" | "strokes"> & { owner: string };

async function asShared(paperId: string, ownerId: string, ownerName: string): Promise<SharedPaper | null> {
  const paper = await getPaper(ownerId, paperId);
  if (!paper) return null;
  // Due dates are the owner's own planning; the rest is what's on the paper.
  const thoughts = paper.thoughts.map((t) => ({ ...t, dueAt: null, dueHasTime: false }));
  return { id: paper.id, name: paper.name, createdAt: paper.createdAt, thoughts, strokes: paper.strokes, owner: ownerName.split(" ")[0] || "Someone" };
}

/** A paper shared with this email (or the owner's own, which goes to the editor instead). */
export async function paperSharedWith(email: string, paperId: string): Promise<SharedPaper | null> {
  const { users } = await import("@/db/schema");
  const [row] = await db
    .select({ ownerId: dropPapers.userId, ownerName: users.name })
    .from(dropShares)
    .innerJoin(dropPapers, eq(dropPapers.id, dropShares.paperId))
    .innerJoin(users, eq(users.id, dropPapers.userId))
    .where(and(eq(dropShares.paperId, paperId), eq(dropShares.email, email.toLowerCase()), isNull(dropPapers.deletedAt)));
  return row ? asShared(paperId, row.ownerId, row.ownerName) : null;
}

/** The paper behind a public link, while the link is on. */
export async function paperByToken(token: string): Promise<SharedPaper | null> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const { users } = await import("@/db/schema");
  const [row] = await db
    .select({ id: dropPapers.id, ownerId: dropPapers.userId, ownerName: users.name })
    .from(dropPapers)
    .innerJoin(users, eq(users.id, dropPapers.userId))
    .where(and(eq(dropPapers.publicToken, token), isNull(dropPapers.deletedAt)));
  return row ? asShared(row.id, row.ownerId, row.ownerName) : null;
}

/** Papers other people shared with this email, for the library. */
export async function sharedWithMe(email: string): Promise<{ id: string; name: string | null; owner: string }[]> {
  const { users } = await import("@/db/schema");
  const rows = await db
    .select({ id: dropPapers.id, name: dropPapers.name, owner: users.name })
    .from(dropShares)
    .innerJoin(dropPapers, eq(dropPapers.id, dropShares.paperId))
    .innerJoin(users, eq(users.id, dropPapers.userId))
    .where(and(eq(dropShares.email, email.toLowerCase()), isNull(dropPapers.deletedAt)))
    .orderBy(asc(dropShares.createdAt));
  return rows;
}
