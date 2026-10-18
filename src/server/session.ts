import "server-only";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export type User = { id: string; email: string; name: string };

/** The signed-in person, or null. */
export async function currentUser(): Promise<User | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  return { id: session.user.id, email: session.user.email, name: session.user.name };
}
