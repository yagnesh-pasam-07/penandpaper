import { withDb } from "@/db";
import { stateFor } from "@/server/api";
import { currentUser } from "@/server/session";

export async function GET() {
  const user = await currentUser();
  const state = await withDb((db) => stateFor(db, user));
  return Response.json(state, { headers: { "Cache-Control": "no-store" } });
}
