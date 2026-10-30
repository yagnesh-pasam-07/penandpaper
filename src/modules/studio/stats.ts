import "server-only";
import { sql } from "drizzle-orm";
import { httpDb as db } from "@/db";
import { dropZone } from "@/modules/drop/server";

/** Where a thought was written, read from its id (each app names its own: see `sourceOf`). */
export const SOURCES = ["canvas", "extension", "mac", "quick", "share"] as const;
export type Source = (typeof SOURCES)[number];

export const SOURCE_LABEL: Record<Source, string> = {
  canvas: "On the paper",
  extension: "Chrome extension",
  mac: "Mac app",
  quick: "Quick box",
  share: "Phone share",
};

/** The id prefixes each app uses: "ext-" (extension), "mac-" (Mac app), "cap-" (the web quick box), "share-" (/share). Anything else was written on the canvas. */
export function sourceOf(id: string): Source {
  if (id.startsWith("ext-")) return "extension";
  if (id.startsWith("mac-")) return "mac";
  if (id.startsWith("cap-")) return "quick";
  if (id.startsWith("share-")) return "share";
  return "canvas";
}

/** The same rule in SQL, so counting never loads the thoughts. */
const SOURCE_SQL = sql`case
  when id like 'ext-%' then 'extension'
  when id like 'mac-%' then 'mac'
  when id like 'cap-%' then 'quick'
  when id like 'share-%' then 'share'
  else 'canvas' end`;

export type Person = {
  id: string;
  name: string;
  email: string;
  joined: string;
  lastActive: string | null;
  thoughts: number;
  papers: number;
  signIn: string[];
};

export type StudioStats = {
  zone: string;
  people: number;
  activeToday: number;
  activeWeek: number;
  activeMonth: number;
  thoughtsToday: number;
  thoughtsWeek: number;
  thoughtsTotal: number;
  papersTotal: number;
  /** People who wrote on at least two different days: the habit. */
  returning: number;
  reviewsWeek: number;
  daily: { day: string; thoughts: number; people: number }[];
  monthly: { month: string; people: number; thoughts: number }[];
  sources: { source: Source; week: number; total: number }[];
  people_: Person[];
};

const n = (v: unknown) => Number(v ?? 0);

type Row = Record<string, unknown>;
const rows = async (q: ReturnType<typeof sql>): Promise<Row[]> => (await db.execute(q)).rows as Row[];

/**
 * Everything Studio shows, in a handful of aggregate queries (no thought is
 * loaded). "Active" means wrote a thought; a day is a day in the app's time
 * zone, the same one the 9 PM email uses. Crumpled thoughts count: they were
 * still written.
 */
export async function studioStats(): Promise<StudioStats> {
  const zone = dropZone();
  const day = sql`(created_at at time zone ${zone})::date`;
  const today = sql`(now() at time zone ${zone})::date`;

  const [totals, daily, monthly, sources, people, reviews] = await Promise.all([
    rows(sql`
      select
        (select count(*) from users) as people,
        (select count(*) from drop_papers where deleted_at is null) as papers,
        (select count(*) from drop_thoughts) as thoughts,
        (select count(*) from drop_thoughts where ${day} = ${today}) as thoughts_today,
        (select count(*) from drop_thoughts where ${day} > ${today} - 7) as thoughts_week,
        (select count(distinct user_id) from drop_thoughts where ${day} = ${today}) as active_today,
        (select count(distinct user_id) from drop_thoughts where ${day} > ${today} - 7) as active_week,
        (select count(distinct user_id) from drop_thoughts where ${day} > ${today} - 30) as active_month,
        (select count(*) from (select user_id from drop_thoughts group by user_id having count(distinct ${day}) >= 2) r) as returning
    `),
    rows(sql`
      select d::date as day, coalesce(t.thoughts, 0) as thoughts, coalesce(t.people, 0) as people
      from generate_series(${today} - 29, ${today}, interval '1 day') d
      left join (select ${day} as day, count(*) as thoughts, count(distinct user_id) as people from drop_thoughts where ${day} > ${today} - 30 group by 1) t on t.day = d::date
      order by d
    `),
    rows(sql`
      with m as (select generate_series(date_trunc('month', now() at time zone ${zone}) - interval '11 months', date_trunc('month', now() at time zone ${zone}), interval '1 month') as month)
      select to_char(m.month, 'YYYY-MM') as month,
        (select count(*) from users u where date_trunc('month', u.created_at at time zone ${zone}) = m.month) as people,
        (select count(*) from drop_thoughts t where date_trunc('month', t.created_at at time zone ${zone}) = m.month) as thoughts
      from m order by m.month
    `),
    rows(sql`
      select ${SOURCE_SQL} as source, count(*) filter (where ${day} > ${today} - 7) as week, count(*) as total
      from drop_thoughts group by 1
    `),
    rows(sql`
      select u.id, u.name, u.email, u.created_at as joined,
        (select max(created_at) from drop_thoughts t where t.user_id = u.id) as last_thought,
        (select max(updated_at) from sessions s where s.user_id = u.id) as last_session,
        (select count(*) from drop_thoughts t where t.user_id = u.id) as thoughts,
        (select count(*) from drop_papers p where p.user_id = u.id and p.deleted_at is null) as papers,
        (select coalesce(array_agg(distinct a.provider_id), '{}') from accounts a where a.user_id = u.id) as sign_in
      from users u
      order by greatest(
        coalesce((select max(created_at) from drop_thoughts t where t.user_id = u.id), u.created_at),
        u.created_at) desc
      limit 500
    `),
    rows(sql`select count(*) as n from drop_daily_reviews where completed_at is not null and date > ${today} - 7`),
  ]);

  const t = totals[0] ?? {};
  const bySource = new Map(sources.map((r) => [String(r.source), r]));
  const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
  return {
    zone,
    people: n(t.people),
    activeToday: n(t.active_today),
    activeWeek: n(t.active_week),
    activeMonth: n(t.active_month),
    thoughtsToday: n(t.thoughts_today),
    thoughtsWeek: n(t.thoughts_week),
    thoughtsTotal: n(t.thoughts),
    papersTotal: n(t.papers),
    returning: n(t.returning),
    reviewsWeek: n(reviews[0]?.n),
    daily: daily.map((r) => ({ day: new Date(String(r.day)).toISOString().slice(0, 10), thoughts: n(r.thoughts), people: n(r.people) })),
    monthly: monthly.map((r) => ({ month: String(r.month), people: n(r.people), thoughts: n(r.thoughts) })),
    sources: SOURCES.map((s) => ({ source: s, week: n(bySource.get(s)?.week), total: n(bySource.get(s)?.total) })),
    people_: people.map((r) => {
      const last = [iso(r.last_thought), iso(r.last_session)].filter((x): x is string => !!x).sort().pop() ?? null;
      const providers = Array.isArray(r.sign_in) ? r.sign_in.map(String) : String(r.sign_in ?? "").replace(/[{}]/g, "").split(",").filter(Boolean);
      return {
        id: String(r.id),
        name: String(r.name ?? ""),
        email: String(r.email ?? ""),
        joined: iso(r.joined) ?? "",
        lastActive: last,
        thoughts: n(r.thoughts),
        papers: n(r.papers),
        signIn: providers.map((p) => (p === "credential" ? "password" : p)),
      };
    }),
  };
}
