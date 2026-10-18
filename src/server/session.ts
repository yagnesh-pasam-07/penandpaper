import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import type { Q } from "@/db/repo";
import { accounts } from "@/db/schema";
import { uid } from "@/lib/mutations";

/**
 * A session is a random token in an httpOnly cookie; the database keeps only
 * its hash. There are no passwords yet: whoever holds the cookie is the account.
 */
const COOKIE = "pp_session";
const ONE_YEAR = 60 * 60 * 24 * 365;

export type Account = typeof accounts.$inferSelect;

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function currentAccount(q: Q): Promise<Account | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [row] = await q.select().from(accounts).where(eq(accounts.tokenHash, hash(token)));
  return row ?? null;
}

export async function createAccount(q: Q, email: string, name: string): Promise<Account> {
  const token = randomBytes(32).toString("base64url");
  const [row] = await q.insert(accounts).values({ id: uid(), email, name, tokenHash: hash(token) }).returning();
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });
  return row;
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
