import "server-only";
import { sql } from "drizzle-orm";
import { httpDb } from "@/db";
import { rateLimits } from "@/db/schema";

/**
 * One use of something costly (like a transcription) by one person, counted in
 * a fixed window kept in the same table Better Auth's limiter uses, so it holds
 * across serverless instances. False when they're past their uses for the window.
 */
export async function allowWithin(key: string, limit: number, windowMs: number, now = Date.now()): Promise<boolean> {
  const stale = now - windowMs;
  const [row] = await httpDb
    .insert(rateLimits)
    .values({ key, count: 1, lastRequest: now })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.lastRequest} < ${stale} then 1 else ${rateLimits.count} + 1 end`,
        lastRequest: sql`case when ${rateLimits.lastRequest} < ${stale} then ${now} else ${rateLimits.lastRequest} end`,
      },
    })
    .returning({ count: rateLimits.count });
  return row.count <= limit;
}
