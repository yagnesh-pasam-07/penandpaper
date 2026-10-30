// Runs before `next build`. On Vercel production (VERCEL_ENV=production) it
// applies pending Drizzle migrations to the production database first, so new
// code never goes live against an old database (the 2026-10-30 outage: the code
// read `users.role` before the column existed). If a migration fails, the build
// fails and the old deployment stays live. Everywhere else (a laptop, a preview)
// it does nothing; run `npm run db:migrate` yourself there.
import { spawnSync } from "node:child_process";

if (process.env.VERCEL_ENV !== "production") {
  console.log("migrate-on-deploy: not a Vercel production build, skipping.");
  process.exit(0);
}
if (!process.env.DATABASE_URL_UNPOOLED && !process.env.DATABASE_URL) {
  console.error("migrate-on-deploy: no DATABASE_URL on Vercel production. Refusing to deploy without migrating.");
  process.exit(1);
}

console.log("migrate-on-deploy: applying pending migrations to production…");
const run = spawnSync("npx", ["drizzle-kit", "migrate"], { stdio: "inherit", env: process.env });
if (run.status !== 0) {
  console.error("migrate-on-deploy: migration failed. Stopping the deploy so the live site keeps working.");
  process.exit(run.status ?? 1);
}
console.log("migrate-on-deploy: database is up to date.");
