import "server-only";
import { Pool, neon, neonConfig } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { env } from "@/lib/env";
import * as schema from "./schema";

// Older Node versions have no global WebSocket.
if (typeof WebSocket === "undefined") neonConfig.webSocketConstructor = ws;

export type Db = NeonDatabase<typeof schema>;

/** Single-query HTTP connection, for Better Auth (it needs no transactions). */
export const httpDb = drizzleHttp(neon(env.DATABASE_URL), { schema });

/**
 * Runs `fn` with a database connection for one request, then closes it.
 * Used where a change needs a transaction that locks rows.
 */
export async function withDb<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  try {
    return await fn(drizzle({ client: pool, schema }));
  } finally {
    await pool.end();
  }
}
