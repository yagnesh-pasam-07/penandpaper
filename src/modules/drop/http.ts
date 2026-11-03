import "server-only";
import { currentUser, type User } from "@/server/session";
import { userFromToken } from "./api-tokens";
import { bearerToken } from "./tokens";

/** The signed-in user, or a 401 response to return as-is. */
export async function requireUser(): Promise<User | Response> {
  const user = await currentUser();
  return user ?? Response.json({ error: "Sign in to use your paper." }, { status: 401 });
}

export const noStore = { headers: { "Cache-Control": "no-store" } };

/**
 * Who sent a capture: a personal access token in `Authorization: Bearer pp_…`
 * (an app, so no origin to check; a web page can't attach that header), or the
 * signed-in session (the caller has already checked where it came from). A
 * token is only ever read from the header, never from the URL. Returns the user,
 * plus the token's id when a token was used (its saves are rate-limited), or a
 * 401 response to return as-is.
 */
export async function userFromRequest(request: Request): Promise<{ user: User; tokenId: string | null } | Response> {
  const header = request.headers.get("authorization");
  if (header) {
    const secret = bearerToken(header);
    const found = secret ? await userFromToken(secret) : null;
    return found ?? Response.json({ error: "That token isn't valid." }, { status: 401 });
  }
  const user = await requireUser();
  return user instanceof Response ? user : { user, tokenId: null };
}

/**
 * The signed-in person, if they may change this paper (its owner, or someone
 * it's shared with to edit), with the owner's id that the paper's rows are kept
 * under; else a 404 to return as-is (never saying whether the paper exists).
 */
export async function requireEditor(paperId: string, who?: User): Promise<{ user: User; ownerId: string } | Response> {
  const user = who ?? (await requireUser());
  if (user instanceof Response) return user;
  const { editorOf } = await import("./server");
  const ed = await editorOf(user, paperId);
  return ed ? { user, ownerId: ed.ownerId } : Response.json({ error: "That paper isn't there any more." }, { status: 404 });
}
