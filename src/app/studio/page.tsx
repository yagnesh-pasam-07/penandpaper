import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { PenIcon } from "@/components/icons";
import { change, type Insight } from "@/modules/studio/insights";
import { studioAdmin, studioConfigured, studioOpen } from "@/modules/studio/gate";
import { SOURCE_LABEL, studioStats, WINDOW_DAYS, type Metric, type StudioStats } from "@/modules/studio/stats";
import { currentUser } from "@/server/session";
import { leave } from "./actions";
import { Bars, RankBars, Rhythm, TabbedChart } from "./charts";
import { GateForm } from "./gate-form";

export const metadata: Metadata = { title: "Studio · Pen & Paper", robots: { index: false, follow: false } };

/**
 * Studio's look: numbers first. Inter with tabular figures (no handwriting
 * here), one blue for data, and green/red only for growth, always with an
 * arrow so colour never carries the meaning alone. The blue was validated
 * against both surfaces (dataviz palette checks).
 */
const studioVars = "[--studio-blue:#2a78d6] [--studio-up:#0b7a0b] [--studio-down:#c43333] [[data-theme=dark]_&]:[--studio-blue:#3987e5] [[data-theme=dark]_&]:[--studio-up:#3fbf3f] [[data-theme=dark]_&]:[--studio-down:#e66767]";
const numbers = "[font-family:var(--font-inter),var(--font-instrument),system-ui,sans-serif] [font-feature-settings:'tnum'_1,'cv11'_1]";
const card = "rounded-2xl border border-line bg-sheet";

function ago(iso: string | null): string {
  if (!iso) return "never";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 300) return "online";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  const d = Math.round(s / 86400);
  return d < 30 ? `${d} d ago` : new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const fmt = (v: number, digits = 0) => v.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });

/** ▲ 24% in green, ▼ 12% in red, or a quiet "new" / "—" when there's nothing to compare with. */
function Delta({ m, suffix = "vs previous 28 days" }: { m: Metric; suffix?: string }) {
  const c = change(m);
  if (c === null) return <span className="text-[13px] text-mute">{m.now ? "new" : "—"}</span>;
  const up = c > 0;
  const flat = c === 0;
  return (
    <span className="flex items-center gap-1.5 text-[13px]">
      <span className="font-semibold" style={{ color: flat ? undefined : up ? "var(--studio-up)" : "var(--studio-down)" }}>
        {flat ? "→ 0%" : `${up ? "▲" : "▼"} ${Math.abs(c)}%`}
      </span>
      <span className="text-mute">{suffix}</span>
    </span>
  );
}

/** A headline card: label, the big number, and its change. */
function Kpi({ label, value, m, note, digits = 0 }: { label: string; value: number; m: Metric; note?: string; digits?: number }) {
  return (
    <div className={`${card} flex flex-col gap-2 p-5`}>
      <span className="text-[13px] font-medium text-mute">{label}</span>
      <span className="text-[40px] leading-none font-semibold tracking-[-0.03em]">{fmt(value, digits)}</span>
      <Delta m={m} />
      {note && <span className="text-[12px] text-mute">{note}</span>}
    </div>
  );
}

const TONE: Record<Insight["tone"], { mark: string; label: string; color: string }> = {
  act: { mark: "●", label: "Act", color: "var(--studio-down)" },
  watch: { mark: "◆", label: "Watch", color: "#c98500" },
  good: { mark: "▲", label: "Good", color: "var(--studio-up)" },
};

function Insights({ list }: { list: Insight[] }) {
  return (
    <section aria-labelledby="insights" className={`${card} flex flex-col gap-1 p-5`}>
      <h2 id="insights" className="pb-2 text-[15px] font-semibold">
        Insights
      </h2>
      {list.length === 0 ? (
        <p className="text-[14px] text-mute">Nothing moved enough to call out. More people, more signal.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {list.slice(0, 6).map((i) => {
            const t = TONE[i.tone];
            return (
              <li key={i.title} className="flex gap-3 py-3">
                <span aria-hidden="true" className="pt-0.5 text-[12px]" style={{ color: t.color }}>
                  {t.mark}
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-[14px] font-semibold">
                    <span className="sr-only">{t.label}: </span>
                    {i.title}
                  </span>
                  <span className="text-[13px] leading-snug text-mute">{i.detail}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Realtime, like YouTube Studio's: who has a paper open right now. */
function Realtime({ s }: { s: StudioStats }) {
  return (
    <section aria-labelledby="realtime" className={`${card} flex flex-col gap-4 p-5`}>
      <h2 id="realtime" className="flex items-center gap-2 text-[15px] font-semibold">
        <span aria-hidden="true" className="relative flex size-2.5">
          {s.onlineNow > 0 && <span className="absolute inline-flex size-full animate-ping rounded-full opacity-60 motion-reduce:hidden" style={{ background: "var(--studio-up)" }} />}
          <span className="relative inline-flex size-2.5 rounded-full" style={{ background: s.onlineNow > 0 ? "var(--studio-up)" : "var(--line)" }} />
        </span>
        Realtime
      </h2>
      <div className="flex flex-col">
        <span className="text-[44px] leading-none font-semibold tracking-[-0.03em]">{s.onlineNow}</span>
        <span className="text-[13px] text-mute">online now · last 5 minutes</span>
      </div>
      {s.onlineNames.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {s.onlineNames.map((name, i) => (
            <li key={`${name}-${i}`} className="rounded-full bg-soft px-2.5 py-1 text-[12px]">
              {name}
            </li>
          ))}
        </ul>
      )}
      <dl className="grid grid-cols-3 gap-3 border-t border-line pt-4">
        {[
          { k: "Today", v: s.activeToday },
          { k: "7 days", v: s.activeWeek },
          { k: "30 days", v: s.activeMonth },
        ].map((x) => (
          <div key={x.k}>
            <dt className="text-[12px] text-mute">{x.k}</dt>
            <dd className="text-[20px] font-semibold">{x.v}</dd>
          </div>
        ))}
      </dl>
      <p className="text-[12px] text-mute">Writers per period. A paper that&apos;s open and visible checks in each minute.</p>
    </section>
  );
}

/** A funnel step: label, count, and the share of the step before. */
function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const top = Math.max(1, steps[0]?.value ?? 1);
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((st, i) => (
        <li key={st.label} className="flex flex-col gap-1.5">
          <span className="flex items-baseline justify-between text-[13px]">
            <span>{st.label}</span>
            <span className="tabular-nums">
              <span className="font-semibold">{st.value}</span>
              {i > 0 && <span className="text-mute"> · {pct(st.value, steps[i - 1].value)}%</span>}
            </span>
          </span>
          <span className="h-2 rounded-full bg-soft">
            <span className="block h-2 rounded-full" style={{ width: `${Math.max(st.value ? 2 : 0, (st.value / top) * 100)}%`, background: "var(--studio-blue)" }} />
          </span>
        </li>
      ))}
    </ol>
  );
}

function Dashboard({ s }: { s: StudioStats }) {
  const day = (iso: string) => new Date(`${iso}T00:00:00`);
  const label = (iso: string) => day(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const short = (iso: string) => String(day(iso).getDate());
  const series = [
    { key: "thoughts", label: "Thoughts", unit: "thoughts", values: s.daily.map((d) => ({ label: label(d.day), short: short(d.day), value: d.thoughts })) },
    { key: "writers", label: "Writers", unit: "people", values: s.daily.map((d) => ({ label: label(d.day), short: short(d.day), value: d.people })) },
    { key: "joined", label: "New people", unit: "people", values: s.daily.map((d) => ({ label: label(d.day), short: short(d.day), value: d.joined })) },
  ];
  const month = (m: string) => new Date(`${m}-01T00:00:00`);
  const monthly = s.monthly.map((m) => ({ label: month(m.month).toLocaleDateString("en-GB", { month: "long", year: "numeric" }), short: month(m.month).toLocaleDateString("en-GB", { month: "short" }), value: m.thoughts }));
  const monthlyPeople = s.monthly.map((m) => ({ label: month(m.month).toLocaleDateString("en-GB", { month: "long", year: "numeric" }), short: month(m.month).toLocaleDateString("en-GB", { month: "short" }), value: m.people }));

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-4 pb-20 sm:px-8">
      {/* Headline numbers, each against the 28 days before. */}
      <section aria-label={`Last ${WINDOW_DAYS} days`} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Writers" value={s.writers.now} m={s.writers} note={`${pct(s.writers.now, s.people)}% of ${s.people} accounts`} />
        <Kpi label="Thoughts" value={s.thoughts.now} m={s.thoughts} note={`${fmt(s.thoughtsTotal)} all time · ${s.papers} papers`} />
        <Kpi label="New people" value={s.newPeople.now} m={s.newPeople} note={`${s.activated.wrote} of them wrote`} />
        <Kpi label="Thoughts per writer" value={s.perWriter.now} m={s.perWriter} digits={1} note="How deep each person goes" />
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <section aria-label="Daily" className={`${card} p-5`}>
          <TabbedChart series={series} />
        </section>
        <Realtime s={s} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Insights list={s.insights} />
        <section aria-labelledby="journey" className={`${card} flex flex-col gap-4 p-5`}>
          <h2 id="journey" className="text-[15px] font-semibold">
            The journey
          </h2>
          <Funnel
            steps={[
              { label: "Joined, last 28 days", value: s.activated.joined },
              { label: "Wrote a first thought", value: s.activated.wrote },
            ]}
          />
          <Funnel
            steps={[
              { label: "Joined 1–5 weeks ago", value: s.retained.cohort },
              { label: "Still writing a week later", value: s.retained.came_back },
            ]}
          />
          <dl className="grid grid-cols-3 gap-3 border-t border-line pt-4">
            <div>
              <dt className="text-[12px] text-mute">Stopped writing</dt>
              <dd className="text-[20px] font-semibold">{s.slipping}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-mute">Never wrote</dt>
              <dd className="text-[20px] font-semibold">{s.neverWrote}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-mute">Tonight reviews</dt>
              <dd className="flex items-baseline gap-2 text-[20px] font-semibold">
                {s.reviews.now}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <section aria-labelledby="sources" className={`${card} flex flex-col gap-4 p-5`}>
          <h2 id="sources" className="flex items-baseline justify-between text-[15px] font-semibold">
            Where thoughts come from <span className="text-[12px] font-normal text-mute">last 28 days</span>
          </h2>
          <RankBars data={s.sources.map((x) => ({ label: SOURCE_LABEL[x.source], now: x.now, before: x.before }))} />
        </section>
        <section aria-labelledby="rhythm" className={`${card} flex flex-col gap-4 p-5`}>
          <h2 id="rhythm" className="flex items-baseline justify-between text-[15px] font-semibold">
            When people think <span className="text-[12px] font-normal text-mute">last 90 days</span>
          </h2>
          <Rhythm weekdays={s.weekdays} hours={s.hours} />
        </section>
      </div>

      <section aria-label="Every month" className={`${card} grid gap-8 p-5 lg:grid-cols-2`}>
        <div className="flex flex-col gap-1">
          <h2 className="text-[15px] font-semibold">Thoughts per month</h2>
          <Bars data={monthly} unit="thoughts" height={140} />
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-[15px] font-semibold">New people per month</h2>
          <Bars data={monthlyPeople} unit="people" height={140} />
        </div>
      </section>

      <section aria-labelledby="people" className={`${card} flex flex-col gap-3 p-5`}>
        <h2 id="people" className="flex items-baseline justify-between text-[15px] font-semibold">
          People <span className="text-[12px] font-normal text-mute">most recently active first</span>
        </h2>
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-[14px] tabular-nums">
            <thead className="text-[12px] text-mute">
              <tr className="border-b border-line">
                <th className="px-2 py-2 font-medium">Person</th>
                <th className="px-2 py-2 font-medium">Last active</th>
                <th className="px-2 py-2 text-right font-medium">28 days</th>
                <th className="px-2 py-2 text-right font-medium">All time</th>
                <th className="px-2 py-2 text-right font-medium">Papers</th>
                <th className="px-2 py-2 font-medium">Joined</th>
                <th className="px-2 py-2 font-medium">Sign-in</th>
              </tr>
            </thead>
            <tbody>
              {s.people_.map((p) => {
                const when = ago(p.lastActive);
                return (
                  <tr key={p.id} className="border-b border-line/60 last:border-0">
                    <td className="px-2 py-2.5">
                      <span className="flex flex-col">
                        <span className="font-medium">{p.name}</span>
                        <span className="text-[13px] text-mute">
                          {p.email}
                          {!p.verified && <span className="ml-1.5 rounded bg-soft px-1.5 py-0.5 text-[11px]">unverified</span>}
                        </span>
                      </span>
                    </td>
                    <td className="px-2 py-2.5">
                      {when === "online" ? (
                        <span className="flex items-center gap-1.5 font-medium" style={{ color: "var(--studio-up)" }}>
                          <span aria-hidden="true" className="size-2 rounded-full" style={{ background: "var(--studio-up)" }} />
                          Online
                        </span>
                      ) : (
                        when
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-right font-semibold">{fmt(p.thoughtsWindow)}</td>
                    <td className="px-2 py-2.5 text-right text-mute">{fmt(p.thoughts)}</td>
                    <td className="px-2 py-2.5 text-right text-mute">{p.papers}</td>
                    <td className="px-2 py-2.5 text-mute">{new Date(p.joined).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })}</td>
                    <td className="px-2 py-2.5 text-mute capitalize">{p.signIn.join(", ") || "email link"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <p className="text-center text-[12px] text-mute">
        Days in {s.zone}. A writer is someone who saved a thought. Changes compare the last {WINDOW_DAYS} days with the {WINDOW_DAYS} before.
      </p>
    </main>
  );
}

/** The Studio brand bar: the pen mark, "Studio", and the way out. */
function Brand({ right }: { right?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center gap-3 px-4 sm:px-8">
        <Link href="/drop" aria-label="Back to my paper" className="flex items-center gap-2 rounded-md">
          <span className="text-red-text">
            <PenIcon size={20} />
          </span>
          <span className="text-[17px] font-semibold tracking-[-0.02em]">
            Studio
          </span>
        </Link>
        <span className="rounded-full border border-line px-2 py-0.5 text-[11px] font-medium text-mute">Pen &amp; Paper</span>
        <span className="ml-auto flex items-center gap-2">{right}</span>
      </div>
    </header>
  );
}

async function Studio() {
  // Never part of a prerender: it reads the session, the cookie and live numbers.
  await connection();
  const admin = await studioAdmin();
  // Lock one, the role: anyone who isn't an admin finds nothing here.
  if (!admin) {
    if (!(await currentUser())) redirect("/login?next=/studio");
    notFound();
  }
  if (!studioConfigured()) {
    return (
      <>
        <Brand />
        <main className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
          <h1 className="text-[28px] font-semibold">Studio is off</h1>
          <p className="text-mute">Set STUDIO_PASSCODE on the server to switch it on.</p>
        </main>
      </>
    );
  }
  // Lock two, the passcode.
  if (!(await studioOpen(admin.id))) {
    return (
      <>
        <Brand />
        <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 pb-24 text-center">
          <span className="flex flex-col gap-2">
            <h1 className="text-[28px] font-semibold tracking-[-0.02em]">Studio</h1>
            <span className="text-[14px] text-mute">Hi {admin.name.split(" ")[0]}. Type the Studio passcode.</span>
          </span>
          <GateForm />
        </main>
      </>
    );
  }
  const stats = await studioStats();
  return (
    <>
      <Brand
        right={
          <>
            <span className="text-[12px] text-mute max-sm:hidden">Last {WINDOW_DAYS} days</span>
            <form action={leave}>
              <button type="submit" className="h-8 rounded-lg px-3 text-[13px] font-medium text-mute hover:bg-soft hover:text-ink">
                Lock
              </button>
            </form>
          </>
        }
      />
      <div className="mx-auto w-full max-w-[1200px] px-4 pt-6 pb-4 sm:px-8">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Overview</h1>
        <p className="text-[14px] text-mute">How Pen &amp; Paper is growing, and what to do next.</p>
      </div>
      <Dashboard s={stats} />
    </>
  );
}

/** /studio: for the admin account, with its passcode. The numbers that say whether Pen & Paper is becoming a habit, and what to do next. */
export default function StudioPage() {
  return (
    <div className={`flex min-h-dvh flex-col bg-bg ${studioVars} ${numbers}`}>
      <Suspense fallback={<div className="flex-1" aria-busy="true" />}>
        <Studio />
      </Suspense>
    </div>
  );
}
