/**
 * Studio's insights: what changed, in plain words, and what to do about it.
 * Pure (no database), so every rule is tested. Each insight has a tone (good,
 * watch, act) and a rank; the page shows the most important first.
 */

export type Insight = { tone: "good" | "watch" | "act"; title: string; detail: string; rank: number };

type Metric = { now: number; before: number };

export type InsightInput = {
  writers: Metric;
  thoughts: Metric;
  newPeople: Metric;
  perWriter: Metric;
  people: number;
  retained: { cohort: number; came_back: number };
  activated: { joined: number; wrote: number };
  slipping: number;
  neverWrote: number;
  reviews: Metric;
  sources: { source: string; now: number; before: number }[];
  weekdays: number[];
  hours: number[];
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SOURCE_NAME: Record<string, string> = { canvas: "the paper", extension: "the Chrome extension", mac: "the Mac app", quick: "the quick box", share: "phone share" };

/** Percent change from `before` to `now`; null when there's no base to compare with. */
export function change(m: Metric): number | null {
  if (m.before === 0) return null;
  return Math.round(((m.now - m.before) / m.before) * 100);
}

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const plural = (k: number, one: string, many = `${one}s`) => `${k} ${k === 1 ? one : many}`;

function hourLabel(h: number): string {
  const end = (h + 1) % 24;
  const f = (x: number) => (x === 0 ? "12 am" : x < 12 ? `${x} am` : x === 12 ? "12 pm" : `${x - 12} pm`);
  return `${f(h)}–${f(end)}`;
}

export function buildInsights(s: InsightInput): Insight[] {
  const out: Insight[] = [];

  // Growth of the one number that matters: people writing.
  const wc = change(s.writers);
  if (wc !== null && wc >= 20) out.push({ tone: "good", rank: 90, title: `Writers up ${wc}%`, detail: `${s.writers.now} people wrote in the last 28 days, up from ${s.writers.before}. Whatever changed, keep doing it.` });
  else if (wc !== null && wc <= -20)
    out.push({ tone: "act", rank: 95, title: `Writers down ${Math.abs(wc)}%`, detail: `${s.writers.now} people wrote in the last 28 days, down from ${s.writers.before}. Look at who slipped (below) and ask them why.` });

  // Activation: people who sign up and never write never come back.
  if (s.activated.joined >= 3) {
    const a = pct(s.activated.wrote, s.activated.joined);
    if (a < 60)
      out.push({ tone: "act", rank: 88, title: `Only ${a}% of new people wrote a first thought`, detail: `${s.activated.wrote} of ${s.activated.joined} who joined this month. Make the first drop happen on the first screen: open the writer straight after sign-up.` });
    else out.push({ tone: "good", rank: 50, title: `${a}% of new people wrote a first thought`, detail: `${s.activated.wrote} of ${s.activated.joined} who joined this month. Activation is healthy.` });
  }

  // Retention: did people who joined a while ago come back a week later?
  if (s.retained.cohort >= 3) {
    const r = pct(s.retained.came_back, s.retained.cohort);
    out.push(
      r < 30
        ? { tone: "act", rank: 85, title: `${r}% came back after their first week`, detail: `${s.retained.came_back} of ${s.retained.cohort} who joined 1–5 weeks ago wrote again a week later. A reason to return (a weekly rewind, a morning resurface) would lift this most.` }
        : { tone: "good", rank: 60, title: `${r}% came back after their first week`, detail: `${s.retained.came_back} of ${s.retained.cohort} who joined 1–5 weeks ago are still writing. That's the habit forming.` },
    );
  }

  // People slipping away.
  if (s.slipping > 0)
    out.push({ tone: "watch", rank: 70, title: `${plural(s.slipping, "person")} stopped writing`, detail: `They wrote in the 28 days before and not since. A short personal note to each can bring them back.` });

  // Never wrote at all.
  if (s.neverWrote > 0 && s.people > 0) {
    const share = pct(s.neverWrote, s.people);
    if (share >= 25)
      out.push({ tone: "watch", rank: 65, title: `${share}% of accounts never wrote anything`, detail: `${plural(s.neverWrote, "account")}. Some may be tests; the rest signed up and left at the empty page.` });
  }

  // Depth: thoughts per writer.
  const dc = change(s.perWriter);
  if (dc !== null && Math.abs(dc) >= 25)
    out.push({
      tone: dc > 0 ? "good" : "watch",
      rank: 55,
      title: `Each writer drops ${dc > 0 ? "more" : "less"}: ${s.perWriter.now.toFixed(1)} thoughts`,
      detail: `Down or up from ${s.perWriter.before.toFixed(1)} in the 28 days before (${dc > 0 ? "+" : ""}${dc}%).`,
    });

  // Capture surfaces: is one taking off, or unused?
  const totalNow = s.sources.reduce((k, x) => k + x.now, 0);
  if (totalNow >= 10) {
    const top = [...s.sources].sort((a, b) => b.now - a.now)[0];
    out.push({ tone: "good", rank: 40, title: `${pct(top.now, totalNow)}% of thoughts come from ${SOURCE_NAME[top.source] ?? top.source}`, detail: `It's where people capture most. Polish it first.` });
    for (const x of s.sources) {
      if ((x.source === "extension" || x.source === "mac") && x.now === 0)
        out.push({ tone: "watch", rank: 45, title: `Nobody used ${SOURCE_NAME[x.source]} this month`, detail: `Show it where people already are: after the first few drops, suggest installing it.` });
    }
  }

  // Ritual: Tonight reviews.
  if (s.writers.now >= 3 && s.reviews.now === 0)
    out.push({ tone: "watch", rank: 50, title: "No one closed the day with Tonight's paper", detail: "The evening review isn't being found. Point to it from the 9 PM email's first line." });

  // When people think: best day and hour.
  const total90 = s.hours.reduce((a, b) => a + b, 0);
  if (total90 >= 20) {
    const bestDay = s.weekdays.indexOf(Math.max(...s.weekdays));
    const bestHour = s.hours.indexOf(Math.max(...s.hours));
    out.push({ tone: "good", rank: 30, title: `People think most on ${DAYS[bestDay]}s, ${hourLabel(bestHour)}`, detail: "Send reminders and the weekly rewind just before then." });
  }

  // New people.
  const nc = change(s.newPeople);
  if (nc !== null && nc <= -30 && s.newPeople.before >= 3)
    out.push({ tone: "watch", rank: 60, title: `Sign-ups down ${Math.abs(nc)}%`, detail: `${s.newPeople.now} this month against ${s.newPeople.before} the month before.` });

  return out.sort((a, b) => b.rank - a.rank);
}
