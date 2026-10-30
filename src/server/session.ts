import "server-only";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export type User = { id: string; email: string; name: string; role: "user" | "admin" };

/** The signed-in person, or null. */
export async function currentUser(): Promise<User | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const role = (session.user as { role?: unknown }).role === "admin" ? "admin" : "user";
  return { id: session.user.id, email: session.user.email, name: session.user.name, role };
}
