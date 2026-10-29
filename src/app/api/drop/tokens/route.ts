import { z } from "zod";
import { createApiToken, listApiTokens } from "@/modules/drop/api-tokens";
import { noStore, requireUser } from "@/modules/drop/http";
import { isSameSite } from "@/modules/drop/share";
import { cleanTokenName, MAX_ACTIVE_TOKENS } from "@/modules/drop/tokens";

const body = z.object({ name: z.string().max(200) });

const notHere = () => Response.json({ error: "Not from this site." }, { status: 403 });

/** Their tokens (never a secret or hash). Signed in on this site only: a token can't manage tokens. */
export async function GET(request: Request) {
  if (request.headers.has("authorization")) return notHere();
  const user = await requireUser();
  if (user instanceof Response) return user;
  return Response.json({ tokens: await listApiTokens(user.id) }, noStore);
}

/** Makes a token and shows its secret once. */
export async function POST(request: Request) {
  if (request.headers.has("authorization") || !isSameSite(request.headers, new URL(request.url).origin)) return notHere();
  const user = await requireUser();
  if (user instanceof Response) return user;
  const parsed = body.safeParse(await request.json().catch(() => null));
  const name = parsed.success ? cleanTokenName(parsed.data.name) : null;
  if (!name) return Response.json({ error: "Give the token a name." }, { status: 400 });
  const made = await createApiToken(user.id, name);
  if (!made) return Response.json({ error: `You can have ${MAX_ACTIVE_TOKENS} tokens at a time. Revoke one first.` }, { status: 409 });
  return Response.json(made, noStore);
}
