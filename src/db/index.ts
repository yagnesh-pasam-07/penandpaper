import "server-only";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { env } from "@/lib/env";
import * as schema from "./schema";

// Older Node versions have no global WebSocket.
if (typeof WebSocket === "undefined") neonConfig.webSocketConstructor = ws;

export type Db = NeonDatabase<typeof schema>;

/**
 * Runs `fn` with a database connection for one request, then closes it.
 * Serverless functions shouldn't keep pools open between requests.
 */
export async function withDb<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  try {
    return await fn(drizzle({ client: pool, schema }));
  } finally {
    await pool.end();
  }
}
