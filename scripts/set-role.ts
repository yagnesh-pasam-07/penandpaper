/**
 * Gives someone a role: "admin" opens Studio (/studio, with its passcode),
 * "user" is everyone else. The only way a role changes; the app never does.
 *   npm run set-role -- you@example.com admin
 *   npm run set-role -- you@example.com user
 * Uses DATABASE_URL from .env.local, or whatever DATABASE_URL is set in the
 * shell (to point it at production for one run).
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { users } from "../src/db/schema";

config({ path: ".env.local" });

const email = process.argv[2]?.trim().toLowerCase();
const role = process.argv[3];
if (!email || !email.includes("@") || (role !== "admin" && role !== "user")) {
  console.error("Usage: npm run set-role -- you@example.com admin|user");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set (see .env.example).");
  process.exit(1);
}

const db = drizzle(neon(process.env.DATABASE_URL));
const done = await db.update(users).set({ role }).where(eq(users.email, email)).returning({ email: users.email, role: users.role });
if (!done.length) {
  console.error(`No account for ${email}. Sign up first, then run this again.`);
  process.exit(1);
}
console.log(`${done[0].email} is now ${done[0].role}. Sign out and back in for it to show.`);
