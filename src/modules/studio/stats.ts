import "server-only";
import { sql } from "drizzle-orm";
import { httpDb as db } from "@/db";
import { dropZone } from "@/modules/drop/server";
import { buildInsights, type Insight } from "./insights";

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

/** The window Studio compares: the last 28 days against the 28 before. */
export const WINDOW_DAYS = 28;

/** A number now and in the window before, so the page can show the change. */
export type Metric = { now: number; before: number };

export type Person = {
  id: string;
  name: string;
  email: string;
  joined: string;
  lastActive: string | null;
  thoughts: number;
  thoughtsWindow: number;
  papers: number;
  signIn: string[];
  verified: boolean;
};

export type StudioStats = {
  zone: string;
  /** Headline numbers for the window, each against the window before. */
  writers: Metric;
  thoughts: Metric;
  newPeople: Metric;
  perWriter: Metric;
  /** Totals, all time. */
  people: number;
  papers: number;
  thoughtsTotal: number;
  /** People with a page open in the last 5 minutes (paper pings), or who saved something then. */
  onlineNow: number;
  onlineNames: string[];
  activeToday: number;
  activeWeek: number;
  activeMonth: number;
  /** Of people who joined 8–35 days ago, how many wrote again a week or more after joining. */
  retained: { cohort: number; came_back: number };
  /** Of everyone who joined in the window, how many wrote a first thought. */
  activated: { joined: number; wrote: number };
  /** People who wrote in the window before but not in this one. */
  slipping: number;
  neverWrote: number;
  reviews: Metric;
  daily: { day: string; thoughts: number; people: number; joined: number }[];
  monthly: { month: string; people: number; thoughts: number }[];
  sources: { source: Source; now: number; before: number; total: number }[];
  /** 0 = Sunday … 6 = Saturday, by thoughts in the last 90 days. */
  weekdays: number[];
  /** 0 … 23, by thoughts in the last 90 days. */
  hours: number[];
  people_: Person[];
  insights: Insight[];
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
  const w = WINDOW_DAYS;
  const day = sql`(created_at at time zone ${zone})::date`;
  const today = sql`(now() at time zone ${zone})::date`;
  // Day counts go in as integers, so date arithmetic and generate_series know their types.
  const days = (k: number) => sql`${k}::int`;
  const inNow = sql`${day} > ${today} - ${days(w)}`;
  const inBefore = sql`${day} > ${today} - ${days(2 * w)} and ${day} <= ${today} - ${days(w)}`;

  const [totals, daily, monthly, sources, people, rhythm] = await Promise.all([
    rows(sql`
      select
        (select count(*) from users) as people,
        (select count(*) from drop_papers where deleted_at is null) as papers,
        (select count(*) from drop_thoughts) as thoughts,
        (select count(*) from drop_thoughts where ${inNow}) as thoughts_now,
        (select count(*) from drop_thoughts where ${inBefore}) as thoughts_before,
        (select count(distinct user_id) from drop_thoughts where ${inNow}) as writers_now,
        (select count(distinct user_id) from drop_thoughts where ${inBefore}) as writers_before,
        (select count(*) from users where ${inNow}) as new_now,
        (select count(*) from users where ${inBefore}) as new_before,
        (select count(distinct user_id) from drop_thoughts where ${day} = ${today}) as active_today,
        (select json_agg(name) from (select u.name from users u where u.last_seen_at > now() - interval '5 minutes'
          or exists (select 1 from drop_thoughts t where t.user_id = u.id and t.created_at > now() - interval '5 minutes')
          order by u.last_seen_at desc nulls last limit 12) o) as online_names,
        (select count(*) from users u where u.last_seen_at > now() - interval '5 minutes'
          or exists (select 1 from drop_thoughts t where t.user_id = u.id and t.created_at > now() - interval '5 minutes')) as online_now,
        (select count(distinct user_id) from drop_thoughts where ${day} > ${today} - 7) as active_week,
        (select count(distinct user_id) from drop_thoughts where ${day} > ${today} - 30) as active_month,
        (select count(*) from users u where not exists (select 1 from drop_thoughts t where t.user_id = u.id)) as never_wrote,
        (select count(*) from (
          select user_id from drop_thoughts where ${inBefore}
          except select user_id from drop_thoughts where ${inNow}) s) as slipping,
        (select count(*) from users u where (u.created_at at time zone ${zone})::date between ${today} - 35 and ${today} - 8) as cohort,
        (select count(*) from users u where (u.created_at at time zone ${zone})::date between ${today} - 35 and ${today} - 8
          and exists (select 1 from drop_thoughts t where t.user_id = u.id and t.created_at >= u.created_at + interval '7 days')) as came_back,
        (select count(*) from users u where ${sql`(u.created_at at time zone ${zone})::date > ${today} - ${days(w)}`}
          and exists (select 1 from drop_thoughts t where t.user_id = u.id)) as activated,
        (select count(*) from drop_daily_reviews where completed_at is not null and date > ${today} - ${days(w)}) as reviews_now,
        (select count(*) from drop_daily_reviews where completed_at is not null and date > ${today} - ${days(2 * w)} and date <= ${today} - ${days(w)}) as reviews_before
    `),
    rows(sql`
      select d::date as day, coalesce(t.thoughts, 0) as thoughts, coalesce(t.people, 0) as people, coalesce(u.joined, 0) as joined
      from generate_series((${today} - ${days(w - 1)})::timestamp, ${today}::timestamp, interval '1 day') d
      left join (select ${day} as day, count(*) as thoughts, count(distinct user_id) as people from drop_thoughts where ${inNow} group by 1) t on t.day = d::date
      left join (select ${day} as day, count(*) as joined from users where ${inNow} group by 1) u on u.day = d::date
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
      select ${SOURCE_SQL} as source,
        count(*) filter (where ${inNow}) as now,
        count(*) filter (where ${inBefore}) as before,
        count(*) as total
      from drop_thoughts group by 1
    `),
    rows(sql`
      select u.id, u.name, u.email, u.created_at as joined, u.email_verified as verified,
        (select max(created_at) from drop_thoughts t where t.user_id = u.id) as last_thought,
        (select max(updated_at) from sessions s where s.user_id = u.id) as last_session,
        (select count(*) from drop_thoughts t where t.user_id = u.id) as thoughts,
        (select count(*) from drop_thoughts t where t.user_id = u.id and ${sql`(t.created_at at time zone ${zone})::date > ${today} - ${days(w)}`}) as thoughts_window,
        (select count(*) from drop_papers p where p.user_id = u.id and p.deleted_at is null) as papers,
        (select coalesce(array_agg(distinct a.provider_id), '{}') from accounts a where a.user_id = u.id) as sign_in
      from users u
      order by coalesce((select max(created_at) from drop_thoughts t where t.user_id = u.id), u.created_at) desc
      limit 500
    `),
    rows(sql`
      select extract(dow from created_at at time zone ${zone})::int as dow, extract(hour from created_at at time zone ${zone})::int as hour, count(*) as c
      from drop_thoughts where ${day} > ${today} - 90 group by 1, 2
    `),
  ]);

  const t = totals[0] ?? {};
  const bySource = new Map(sources.map((r) => [String(r.source), r]));
  const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
  const weekdays = Array(7).fill(0);
  const hours = Array(24).fill(0);
  for (const r of rhythm) {
    weekdays[n(r.dow)] += n(r.c);
    hours[n(r.hour)] += n(r.c);
  }
  const writers = { now: n(t.writers_now), before: n(t.writers_before) };
  const thoughts = { now: n(t.thoughts_now), before: n(t.thoughts_before) };
  const per = (m: Metric, k: Metric) => ({ now: k.now ? m.now / k.now : 0, before: k.before ? m.before / k.before : 0 });

  const stats: Omit<StudioStats, "insights"> = {
    zone,
    writers,
    thoughts,
    newPeople: { now: n(t.new_now), before: n(t.new_before) },
    perWriter: per(thoughts, writers),
    people: n(t.people),
    papers: n(t.papers),
    thoughtsTotal: n(t.thoughts),
    onlineNow: n(t.online_now),
    onlineNames: Array.isArray(t.online_names) ? t.online_names.map(String) : [],
    activeToday: n(t.active_today),
    activeWeek: n(t.active_week),
    activeMonth: n(t.active_month),
    retained: { cohort: n(t.cohort), came_back: n(t.came_back) },
    activated: { joined: n(t.new_now), wrote: n(t.activated) },
    slipping: n(t.slipping),
    neverWrote: n(t.never_wrote),
    reviews: { now: n(t.reviews_now), before: n(t.reviews_before) },
    daily: daily.map((r) => ({ day: new Date(String(r.day)).toISOString().slice(0, 10), thoughts: n(r.thoughts), people: n(r.people), joined: n(r.joined) })),
    monthly: monthly.map((r) => ({ month: String(r.month), people: n(r.people), thoughts: n(r.thoughts) })),
    sources: SOURCES.map((s) => ({ source: s, now: n(bySource.get(s)?.now), before: n(bySource.get(s)?.before), total: n(bySource.get(s)?.total) })),
    weekdays,
    hours,
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
        thoughtsWindow: n(r.thoughts_window),
        papers: n(r.papers),
        signIn: providers.map((p) => (p === "credential" ? "password" : p)),
        verified: r.verified === true || r.verified === "t",
      };
    }),
  };
  return { ...stats, insights: buildInsights(stats) };
}
