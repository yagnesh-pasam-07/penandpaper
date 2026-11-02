import "server-only";
import { and, eq, inArray, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { httpDb } from "@/db";
import { users } from "@/db/schema";
import { appUrl } from "@/lib/env";
import { sendMail } from "@/server/email";
import { sendPush, vapidFromEnv } from "@/server/web-push";
import { dueLabel } from "./logic";
import { dropPapers, dropPrefs, dropPushSubscriptions, dropThoughts } from "./schema";

const db = httpDb;

/**
 * Reminders for to-dos with a date. Each one owed (its time has come, or, with
 * only a day, that day has started) goes out once: a notification on every
 * device the person turned them on for, else an email. Marked sent so it never
 * repeats; changing the date makes it owed again.
 *
 * Runs with both daily jobs (9 AM and 9 PM IST on Vercel Hobby). With an
 * hourly job (`/api/cron/reminders`, Vercel Pro) a reminder lands within the hour.
 * While the paper is open, the browser reminds on the minute itself.
 */
export async function sendReminders(now: Date, fallbackTz: string): Promise<{ reminded: number }> {
  // A day-only date is stored as that day's start in the person's zone, so "start <= now" covers both kinds.
  const rows = await db
    .select({
      id: dropThoughts.id,
      text: dropThoughts.text,
      dueAt: dropThoughts.dueAt,
      dueHasTime: dropThoughts.dueHasTime,
      paperId: dropThoughts.paperId,
      userId: dropThoughts.userId,
      email: users.email,
      tz: dropPrefs.timeZone,
    })
    .from(dropThoughts)
    .innerJoin(dropPapers, eq(dropPapers.id, dropThoughts.paperId))
    .innerJoin(users, eq(users.id, dropThoughts.userId))
    .leftJoin(dropPrefs, eq(dropPrefs.userId, dropThoughts.userId))
    .where(
      and(
        isNotNull(dropThoughts.dueAt),
        lte(dropThoughts.dueAt, now.toISOString()),
        // Older than three days is stale: don't wake someone for last week.
        sql`${dropThoughts.dueAt} > ${new Date(now.getTime() - 3 * 86_400_000).toISOString()}`,
        isNull(dropThoughts.remindedAt),
        isNull(dropThoughts.crumpledAt),
        isNull(dropPapers.deletedAt),
        eq(dropThoughts.status, "open"),
      ),
    )
    .limit(500);
  if (!rows.length) return { reminded: 0 };

  const vapid = vapidFromEnv();
  const userIds = [...new Set(rows.map((r) => r.userId))];
  const devices = vapid ? await db.select().from(dropPushSubscriptions).where(inArray(dropPushSubscriptions.userId, userIds)) : [];

  let reminded = 0;
  for (const r of rows) {
    const tz = r.tz || fallbackTz;
    const when = dueLabel(r.dueAt!, r.dueHasTime, now, tz).text;
    const words = r.text.length > 120 ? `${r.text.slice(0, 119)}…` : r.text;
    const url = `/drop/${r.paperId}?note=${encodeURIComponent(r.id)}`;
    let delivered = false;
    for (const d of devices.filter((x) => x.userId === r.userId)) {
      const res = await sendPush({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, { title: `Reminder · ${when}`, body: words, url, tag: `pp-remind-${r.id}`, sound: true }, vapid!);
      if (res === "sent") delivered = true;
      else if (res === "gone") await db.delete(dropPushSubscriptions).where(eq(dropPushSubscriptions.endpoint, d.endpoint));
    }
    if (!delivered) {
      delivered = await sendMail({
        to: r.email,
        subject: `Reminder: ${words.slice(0, 60)}`,
        heading: words,
        lines: [`You asked to be reminded: ${when}.`],
        cta: { label: "Open it on the paper", url: `${appUrl}${url}` },
      }).catch(() => false);
    }
    if (delivered) {
      reminded += 1;
      await db.update(dropThoughts).set({ remindedAt: now.toISOString() }).where(eq(dropThoughts.id, r.id));
    }
  }
  return { reminded };
}
