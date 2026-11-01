/**
 * Adds a story written as a Markdown file (content/stories/*.md, with a small
 * front matter: title, subtitle, hook, category, language) to Studio as a
 * DRAFT for an admin. It never publishes: open it in Studio, add the cover
 * and press Publish.
 *   npm run story:add -- content/stories/the-man-behind-the-words.md you@example.com
 * Uses DATABASE_URL from .env.local, or whatever is set in the shell.
 */
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { and, eq, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { users } from "../src/db/schema";
import { CATEGORIES, readingMinutes, slugify, uniqueSlug, type Category } from "../src/modules/stories/logic";
import { stories } from "../src/modules/stories/schema";

config({ path: ".env.local" });

const [file, emailArg] = process.argv.slice(2);
const email = emailArg?.trim().toLowerCase();
if (!file || !email?.includes("@")) {
  console.error("Usage: npm run story:add -- content/stories/<file>.md you@example.com");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set (see .env.example).");
  process.exit(1);
}

const raw = readFileSync(file, "utf8");
const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
if (!m) {
  console.error("The file needs a front matter block between --- lines.");
  process.exit(1);
}
const meta = Object.fromEntries(m[1].split("\n").map((l) => [l.slice(0, l.indexOf(":")).trim(), l.slice(l.indexOf(":") + 1).trim()]));
const body = m[2].trim();
const title = meta.title ?? "";
const category = (CATEGORIES as readonly string[]).includes(meta.category) ? (meta.category as Category) : "human";

const db = drizzle(neon(process.env.DATABASE_URL));
const [author] = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.email, email)).limit(1);
if (!author || author.role !== "admin") {
  console.error(`${email} isn't an admin. Run npm run set-role -- ${email} admin first.`);
  process.exit(1);
}
const [same] = await db.select({ id: stories.id }).from(stories).where(and(eq(stories.title, title), eq(stories.authorId, author.id))).limit(1);
if (same) {
  console.error(`"${title}" is already in Studio: /studio/stories/${same.id}`);
  process.exit(1);
}
const base = slugify(title);
const taken = await db.select({ slug: stories.slug }).from(stories).where(like(stories.slug, `${base}%`));
const [row] = await db
  .insert(stories)
  .values({ slug: uniqueSlug(base, taken.map((t) => t.slug)), title, subtitle: meta.subtitle ?? "", hook: meta.hook ?? "", body, category, language: meta.language || "en", readingMinutes: readingMinutes(body), authorId: author.id })
  .returning({ id: stories.id, slug: stories.slug });
console.log(`Draft added: /studio/stories/${row.id} (address /stories/${row.slug}). Add a cover and press Publish.`);
