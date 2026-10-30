import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { httpDb as db } from "@/db";
import { users } from "@/db/schema";
import { noStore, requireUser } from "@/modules/drop/http";

/**
 * "I'm here": sent each minute while a paper is open and visible, for Studio's
 * "online now". Writes at most once every 50 seconds per person.
 */
export async function POST() {
  const user = await requireUser();
  if (user instanceof Response) return user;
  await db
    .update(users)
    .set({ lastSeenAt: sql`now()` })
    .where(and(eq(users.id, user.id), or(isNull(users.lastSeenAt), lt(users.lastSeenAt, sql`now() - interval '50 seconds'`))));
  return new Response(null, { status: 204, ...noStore });
}
