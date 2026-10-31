import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { httpDb } from "@/db";
import { sendPush, vapidFromEnv, type PushSubscription } from "@/server/web-push";
import { latestPaperId } from "./server";
import { DAILY_CAP, DEFAULT_RECALL_TIME, isDue, localClock, nextShow, notificationText, parseDays, pickThought, shouldNotify, wroteAgo, type Candidate } from "./recall";
import { dropPapers, dropPrefs, dropPushSubscriptions, dropThoughts } from "./schema";

const db = httpDb;

/** The day's thought as the full-screen card shows it. */
export type DailyThought = {
  id: string;
  text: string;
  image: string | null;
  kind: "note" | "text";
  createdAt: string;
  /** "You wrote this 12 days ago". */
  ago: string;
  paperId: string;
  paperName: string | null;
};

export type RecallSettings = { on: boolean; time: string | null; days: number[]; sound: boolean; devices: number };

/** What the greeting needs: the thought (if one is due), whether to play the sound, and how many more "Show another" allow. */
export type RecallState = { thought: DailyThought | null; due: boolean; sound: boolean; left: number };

type Prefs = typeof dropPrefs.$inferSelect;

async function prefsOf(userId: string): Promise<Prefs | null> {
  try {
    const [row] = await db.select().from(dropPrefs).where(eq(dropPrefs.userId, userId));
    return row ?? null;
  } catch {
    // Before `npm run db:migrate`: no recall yet.
    return null;
  }
}

/** Every past thought that could come back: live, on a paper that isn't deleted, not struck, still in rotation, with something to show. */
async function candidatesOf(userId: string): Promise<(Candidate & { row: DailyThought })[]> {
  const rows = await db
    .select({
      id: dropThoughts.id,
      text: dropThoughts.text,
      image: dropThoughts.image,
      kind: dropThoughts.kind,
      createdAt: dropThoughts.createdAt,
      dueAt: dropThoughts.resurfaceAt,
      lastShownAt: dropThoughts.recallShownAt,
      paperId: dropPapers.id,
      paperName: dropPapers.name,
    })
    .from(dropThoughts)
    .innerJoin(dropPapers, eq(dropPapers.id, dropThoughts.paperId))
    .where(
      and(
        eq(dropThoughts.userId, userId),
        eq(dropThoughts.status, "open"),
        isNull(dropThoughts.crumpledAt),
        isNull(dropPapers.deletedAt),
        eq(dropThoughts.resurfaceDone, false),
        sql`(length(trim(${dropThoughts.text})) > 0 or ${dropThoughts.image} is not null)`,
      ),
    )
    .limit(5000);
  return rows.map((r) => {
    const createdAt = new Date(r.createdAt).toISOString();
    return {
      id: r.id,
      createdAt,
      dueAt: r.dueAt ? new Date(r.dueAt).toISOString() : null,
      lastShownAt: r.lastShownAt ? new Date(r.lastShownAt).toISOString() : null,
      row: { id: r.id, text: r.text, image: r.image, kind: r.kind, createdAt, ago: "", paperId: r.paperId, paperName: r.paperName },
    };
  });
}

/** Picks today's thought for this person (or null), skipping the ones they passed over today. */
async function pick(userId: string, tz: string, now: Date, skip: string[]): Promise<DailyThought | null> {
  const all = await candidatesOf(userId);
  const chosen = pickThought(all, now, `${userId}:${localClock(tz, now).date}:${skip.length}`, skip);
  if (!chosen) return null;
  const { row } = all.find((c) => c.id === chosen.id)!;
  return { ...row, ago: wroteAgo(row.createdAt, now) };
}

const settingsOf = (p: Prefs | null) => ({
  time: p ? p.recallTime : DEFAULT_RECALL_TIME,
  days: parseDays(p?.recallDays),
});

/**
 * What to greet them with now: today's thought when it is due (after their
 * time, not yet seen today, switched on), otherwise nothing. `force` shows it
 * anyway (opened from the notification, or from the Today button).
 */
export async function recallState(userId: string, tz: string, now: Date = new Date(), force = false): Promise<RecallState> {
  const p = await prefsOf(userId);
  const on = p?.resurface ?? true;
  const { time, days } = settingsOf(p);
  const date = localClock(tz, now).date;
  const skipped = p?.recallSkipped?.date === date ? p.recallSkipped.ids : [];
  const due = on && isDue({ time, days, seenOn: p?.recallSeenOn ?? null }, tz, now);
  if (!force && !due) return { thought: null, due: false, sound: false, left: 0 };
  try {
    const thought = await pick(userId, tz, now, skipped);
    return { thought, due, sound: due && (p?.recallSound ?? true), left: Math.max(0, DAILY_CAP - 1 - skipped.length) };
  } catch {
    return { thought: null, due: false, sound: false, left: 0 };
  }
}

/** Remembers their zone (so the daily job knows their 9 AM), without touching anything else. */
export async function noteZone(userId: string, tz: string): Promise<void> {
  try {
    await db.insert(dropPrefs).values({ userId, timeZone: tz }).onConflictDoUpdate({ target: dropPrefs.userId, set: { timeZone: tz } });
  } catch {
    // Before the migration: nothing to remember yet.
  }
}

export type RecallAction = "use" | "tomorrow" | "another" | "seen";

/**
 * What they did with today's thought:
 * - use: it goes onto today's paper (the paper they touched last) as a fresh copy, and leaves rotation;
 * - tomorrow: back into rotation, further out each time (1 → 3 → 7 → 21 → 60 days);
 * - another: passed over for today (at most DAILY_CAP a day);
 * - seen: closed without choosing; it may come back another day.
 * Every one marks today as seen, so other devices stop greeting (and the notification isn't sent again).
 */
export async function actOnRecall(userId: string, thoughtId: string, action: RecallAction, tz: string, now: Date = new Date()): Promise<{ ok: boolean; paperId?: string; newId?: string }> {
  const [t] = await db
    .select({ id: dropThoughts.id, text: dropThoughts.text, image: dropThoughts.image, kind: dropThoughts.kind, shape: dropThoughts.shape, step: dropThoughts.resurfaceStep })
    .from(dropThoughts)
    .where(and(eq(dropThoughts.id, thoughtId), eq(dropThoughts.userId, userId), isNull(dropThoughts.crumpledAt)));
  if (!t) return { ok: false };
  const date = localClock(tz, now).date;
  const at = now.toISOString();
  let result: { ok: boolean; paperId?: string; newId?: string } = { ok: true };

  if (action === "use") {
    const paperId = await latestPaperId(userId);
    const newId = `use-${thoughtId.slice(0, 20)}-${Math.random().toString(36).slice(2, 8)}`;
    await db.insert(dropThoughts).values({ id: newId, paperId, userId, text: t.text, image: t.image, kind: t.kind, shape: t.shape });
    await db.update(dropPapers).set({ updatedAt: sql`now()` }).where(eq(dropPapers.id, paperId));
    await db.update(dropThoughts).set({ resurfaceDone: true, recallShownAt: at }).where(eq(dropThoughts.id, thoughtId));
    result = { ok: true, paperId, newId };
  } else if (action === "tomorrow") {
    await db
      .update(dropThoughts)
      .set({ resurfaceStep: t.step + 1, resurfaceAt: nextShow(t.step, now), recallShownAt: at })
      .where(eq(dropThoughts.id, thoughtId));
  } else {
    await db.update(dropThoughts).set({ recallShownAt: at }).where(eq(dropThoughts.id, thoughtId));
  }

  const p = await prefsOf(userId);
  const before = p?.recallSkipped?.date === date ? p.recallSkipped.ids : [];
  const skipped = action === "another" ? { date, ids: [...before, thoughtId].slice(-DAILY_CAP) } : (p?.recallSkipped ?? null);
  await db
    .insert(dropPrefs)
    .values({ userId, recallSeenOn: date, recallSkipped: skipped, timeZone: tz })
    .onConflictDoUpdate({ target: dropPrefs.userId, set: { recallSeenOn: date, recallSkipped: skipped, timeZone: tz } });
  return result;
}

/* ---------- Settings ---------- */

export async function recallSettings(userId: string): Promise<RecallSettings> {
  const p = await prefsOf(userId);
  let devices = 0;
  try {
    const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(dropPushSubscriptions).where(eq(dropPushSubscriptions.userId, userId));
    devices = row?.n ?? 0;
  } catch {}
  const { time, days } = settingsOf(p);
  return { on: p?.resurface ?? true, time, days, sound: p?.recallSound ?? true, devices };
}

export async function saveRecallSettings(userId: string, s: Partial<Omit<RecallSettings, "devices">>): Promise<void> {
  const set = {
    ...(s.on !== undefined ? { resurface: s.on } : {}),
    ...(s.time !== undefined ? { recallTime: s.time } : {}),
    ...(s.days !== undefined ? { recallDays: parseDays(s.days) } : {}),
    ...(s.sound !== undefined ? { recallSound: s.sound } : {}),
  };
  if (!Object.keys(set).length) return;
  await db.insert(dropPrefs).values({ userId, ...set }).onConflictDoUpdate({ target: dropPrefs.userId, set });
}

/* ---------- Devices (web push) ---------- */

export async function addDevice(userId: string, sub: PushSubscription, device: string | null): Promise<void> {
  await db
    .insert(dropPushSubscriptions)
    .values({ endpoint: sub.endpoint, userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, device })
    .onConflictDoUpdate({ target: dropPushSubscriptions.endpoint, set: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, device } });
}

export async function removeDevice(userId: string, endpoint: string): Promise<void> {
  await db.delete(dropPushSubscriptions).where(and(eq(dropPushSubscriptions.endpoint, endpoint), eq(dropPushSubscriptions.userId, userId)));
}

/**
 * The daily job: everyone whose recall time has come (in `windowMin` minutes
 * before now) and who hasn't seen or been sent today's thought gets one
 * notification on every device they turned it on for. A device that has
 * unsubscribed is forgotten. Nobody is notified on a day with nothing to show.
 */
export async function sendRecalls(now: Date, windowMin: number, fallbackTz: string): Promise<{ people: number; sent: number; gone: number }> {
  const vapid = vapidFromEnv();
  if (!vapid) return { people: 0, sent: 0, gone: 0 };
  const subs = await db.select().from(dropPushSubscriptions);
  const byUser = new Map<string, typeof subs>();
  subs.forEach((s) => byUser.set(s.userId, [...(byUser.get(s.userId) ?? []), s]));
  let people = 0;
  let sent = 0;
  let gone = 0;
  for (const [userId, devices] of byUser) {
    const p = await prefsOf(userId);
    if (p && !p.resurface) continue;
    const tz = p?.timeZone || fallbackTz;
    const { time, days } = settingsOf(p);
    if (!shouldNotify({ time, days, seenOn: p?.recallSeenOn ?? null, notifiedOn: p?.recallNotifiedOn ?? null }, tz, now, windowMin)) continue;
    const thought = await pick(userId, tz, now, []);
    if (!thought) continue;
    const words = notificationText(thought.text);
    const payload = { ...words, url: "/drop?today=1", tag: "pp-today", sound: p?.recallSound ?? true };
    let any = false;
    for (const d of devices) {
      const r = await sendPush({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, payload, vapid);
      if (r === "sent") {
        sent += 1;
        any = true;
      } else if (r === "gone") {
        gone += 1;
        await db.delete(dropPushSubscriptions).where(eq(dropPushSubscriptions.endpoint, d.endpoint));
      }
    }
    if (any) {
      people += 1;
      const date = localClock(tz, now).date;
      await db.insert(dropPrefs).values({ userId, recallNotifiedOn: date }).onConflictDoUpdate({ target: dropPrefs.userId, set: { recallNotifiedOn: date } });
    }
  }
  return { people, sent, gone };
}
