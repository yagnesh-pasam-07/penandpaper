import "server-only";
import { currentUser, type User } from "@/server/session";

/** The signed-in user, or a 401 response to return as-is. */
export async function requireUser(): Promise<User | Response> {
  const user = await currentUser();
  return user ?? Response.json({ error: "Sign in to use your paper." }, { status: 401 });
}

export const noStore = { headers: { "Cache-Control": "no-store" } };
