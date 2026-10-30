import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { env } from "@/lib/env";
import { currentUser, type User } from "@/server/session";

/**
 * Studio has two locks, and both must open:
 *  1. the account's role is "admin" (set in the database by `npm run set-role`,
 *     never by the app), and
 *  2. the Studio passcode (STUDIO_PASSCODE) was typed in this browser today.
 * A leaked passcode is useless without the admin account, and a borrowed admin
 * session is useless without the passcode.
 */

/** The cookie that keeps Studio open after the passcode, for a day. */
export const STUDIO_COOKIE = "pp-studio";
const DAY_S = 24 * 60 * 60;

/** Studio is switched off until STUDIO_PASSCODE is set (see .env.example). */
export function studioConfigured(): boolean {
  return Boolean(env.STUDIO_PASSCODE);
}

/** The signed-in admin, or null for anyone else (signed out, or an ordinary user). */
export async function studioAdmin(): Promise<User | null> {
  const user = await currentUser();
  return user?.role === "admin" ? user : null;
}

const sign = (value: string) => createHmac("sha256", `${env.BETTER_AUTH_SECRET}:studio`).update(value).digest("hex");

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Whether the typed passcode is STUDIO_PASSCODE (spaces ignored, letters in any case), compared in constant time. */
export function passcodeMatches(typed: string): boolean {
  const want = env.STUDIO_PASSCODE;
  if (!want) return false;
  const norm = (v: string) => v.replace(/\s+/g, "").toLowerCase();
  return same(sign(norm(typed)), sign(norm(want)));
}

/**
 * The cookie's value: who it was opened for and until when, signed with the
 * app's secret and the passcode itself. Changing STUDIO_PASSCODE locks every
 * browser; signing in as someone else doesn't carry it over.
 */
function token(userId: string, until: number): string {
  return `${until}.${sign(`${userId}:${until}:${env.STUDIO_PASSCODE ?? ""}`)}`;
}

export async function openStudio(userId: string): Promise<void> {
  const until = Math.floor(Date.now() / 1000) + DAY_S;
  const secure = (await headers()).get("x-forwarded-proto") === "https" || process.env.NODE_ENV === "production";
  (await cookies()).set(STUDIO_COOKIE, token(userId, until), { httpOnly: true, sameSite: "strict", secure, path: "/studio", maxAge: DAY_S });
}

export async function closeStudio(): Promise<void> {
  (await cookies()).delete({ name: STUDIO_COOKIE, path: "/studio" });
}

/** Whether this admin typed the passcode in this browser in the last day. */
export async function studioOpen(userId: string): Promise<boolean> {
  if (!studioConfigured()) return false;
  const raw = (await cookies()).get(STUDIO_COOKIE)?.value ?? "";
  const until = Number(raw.split(".")[0]);
  if (!Number.isFinite(until) || until < Date.now() / 1000) return false;
  return same(raw, token(userId, until));
}
