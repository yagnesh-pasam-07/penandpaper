/**
 * Seeds a week of Drop papers for one person, for trying the app locally.
 *   npm run seed -- you@example.com
 * Uses DATABASE_URL from .env.local (the Neon "dev" branch). Refuses to run
 * against a database that already has papers for that person.
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { users } from "../src/db/schema";
import { dropPapers, dropThoughts } from "../src/modules/drop/schema";

config({ path: ".env.local" });

const email = process.argv[2]?.toLowerCase();
if (!email || !email.includes("@")) {
  console.error("Usage: npm run seed -- you@example.com");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set (see .env.example).");
  process.exit(1);
}

const db = drizzle(neon(process.env.DATABASE_URL));
const day = (offset: number) => {
  const d = new Date(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date()));
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
const id = () => Math.random().toString(36).slice(2, 12) + Date.now().toString(36).slice(-4);

const week: { offset: number; thoughts: [string, boolean][] }[] = [
  { offset: -4, thoughts: [["Book dentist appointment", true], ["Read the Stripe docs on webhooks https://docs.stripe.com/webhooks", true], ["Idea: weekly review on Fridays", false]] },
  { offset: -3, thoughts: [["Call the bank about the card", true], ["Buy a birthday gift for Amma", true], ["Pay electricity bill", true]] },
  { offset: -2, thoughts: [["Draft the Q4 plan", true], ["Reply to Ravi's email", true], ["Try the new coffee place on 5th", false]] },
  { offset: -1, thoughts: [["Renew passport", false], ["Fix the flaky login test", true], ["Ship the onboarding copy", true], ["Look into www.neon.tech branching", false]] },
];

async function main() {
  const [user] = await db
    .insert(users)
    .values({ email, name: email.split("@")[0].replace(/^./, (c) => c.toUpperCase()), emailVerified: false })
    .onConflictDoUpdate({ target: users.email, set: { email } })
    .returning({ id: users.id });

  for (const { offset, thoughts } of week) {
    const date = day(offset);
    const [exists] = await db.select({ id: dropPapers.id }).from(dropPapers).where(and(eq(dropPapers.userId, user.id), eq(dropPapers.date, date)));
    if (exists) {
      console.error(`${email} already has a paper on ${date}; not seeding over it.`);
      process.exit(1);
    }
    const [paper] = await db.insert(dropPapers).values({ userId: user.id, date }).returning({ id: dropPapers.id });
    await db.insert(dropThoughts).values(
      thoughts.map(([text, done], i) => ({
        id: id(),
        paperId: paper.id,
        userId: user.id,
        text,
        status: done ? ("done" as const) : ("open" as const),
        shape: i % 6,
        createdAt: `${date}T0${3 + i}:1${i}:00Z`,
        doneAt: done ? `${date}T1${i}:00:00Z` : null,
      })),
    );
    console.log(`  ${date}: ${thoughts.length} thoughts`);
  }
  console.log(`Seeded ${week.length} past papers for ${email}. Sign in with that email and open /drop: yesterday's open thoughts roll over.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
