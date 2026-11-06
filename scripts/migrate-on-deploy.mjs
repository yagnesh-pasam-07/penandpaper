// Runs before `next build`. On Vercel production (VERCEL_ENV=production) it
// applies pending Drizzle migrations to the production database first, so new
// code never goes live against an old database (the 2026-10-30 outage: the code
// read `users.role` before the column existed). If a migration fails, the build
// fails and the old deployment stays live. Everywhere else (a laptop, a preview)
// it does nothing; run `npm run db:migrate` yourself there.
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import ws from "ws";

if (process.env.VERCEL_ENV !== "production") {
  console.log("migrate-on-deploy: not a Vercel production build, skipping.");
  process.exit(0);
}
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error("migrate-on-deploy: no DATABASE_URL on Vercel production. Refusing to deploy without migrating.");
  process.exit(1);
}

// drizzle-orm's own migrator (the same journal and table as `drizzle-kit migrate`),
// because drizzle-kit exits 1 on a failure without saying what the database said.
if (typeof WebSocket === "undefined") neonConfig.webSocketConstructor = ws;
console.log("migrate-on-deploy: applying pending migrations to production…");
const pool = new Pool({ connectionString: url });
try {
  await migrate(drizzle({ client: pool }), { migrationsFolder: "./drizzle" });
  console.log("migrate-on-deploy: database is up to date.");
} catch (e) {
  console.error("migrate-on-deploy: migration failed. Stopping the deploy so the live site keeps working.");
  console.error(e?.cause ?? e);
  process.exitCode = 1;
} finally {
  await pool.end();
}
