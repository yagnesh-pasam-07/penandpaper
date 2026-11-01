import { currentUser } from "@/server/session";

/** `GET /api/stories/me`: the signed-in reader's first name and picture, for the stories header. Nothing when signed out. */
export async function GET() {
  const user = await currentUser().catch(() => null);
  return Response.json(user ? { name: user.name } : null, { headers: { "Cache-Control": "no-store" } });
}
