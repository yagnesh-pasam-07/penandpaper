import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Logo } from "@/components/ui";
import { studioAdmin, studioConfigured, studioOpen } from "@/modules/studio/gate";
import { SOURCE_LABEL, studioStats, type StudioStats } from "@/modules/studio/stats";
import { currentUser } from "@/server/session";
import { leave } from "./actions";
import { Bars, SourceBars } from "./charts";
import { GateForm } from "./gate-form";

export const metadata: Metadata = { title: "Studio · Pen & Paper", robots: { index: false, follow: false } };

const card = "rounded-2xl border border-line bg-sheet p-5 sm:p-6";

function ago(iso: string | null): string {
  if (!iso) return "never";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  const d = Math.round(s / 86400);
  return d < 30 ? `${d} d ago` : new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–");

/** A headline number: big, with one line saying what it means. */
function Stat({ value, label, note }: { value: number | string; label: string; note?: string }) {
  return (
    <div className={`${card} flex flex-col gap-1`}>
      <span className="text-[13px] font-medium text-mute">{label}</span>
      <span className="font-hand text-[52px] leading-none font-bold tabular-nums">{typeof value === "number" ? value.toLocaleString() : value}</span>
      {note && <span className="text-[13px] text-mute">{note}</span>}
    </div>
  );
}

function Dashboard({ s }: { s: StudioStats }) {
  const day = (iso: string) => new Date(`${iso}T00:00:00`);
  const daily = s.daily.map((d) => ({ label: day(d.day).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }), short: String(day(d.day).getDate()), value: d.thoughts }));
  const dailyPeople = s.daily.map((d) => ({ label: day(d.day).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }), short: String(day(d.day).getDate()), value: d.people }));
  const month = (m: string) => new Date(`${m}-01T00:00:00`);
  const monthlyPeople = s.monthly.map((m) => ({ label: month(m.month).toLocaleDateString("en-GB", { month: "long", year: "numeric" }), short: month(m.month).toLocaleDateString("en-GB", { month: "short" }), value: m.people }));
  const monthlyThoughts = s.monthly.map((m) => ({ ...monthlyPeople.find((p) => p.label === month(m.month).toLocaleDateString("en-GB", { month: "long", year: "numeric" }))!, value: m.thoughts }));
  const sources = s.sources.map((x) => ({ label: SOURCE_LABEL[x.source], value: x.week, total: x.total }));
  const perActive = s.activeWeek ? (s.thoughtsWeek / s.activeWeek).toFixed(1) : "–";

  return (
    <main className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-4 pt-4 pb-20 sm:px-8">
      {/* The one question: is it becoming a habit? */}
      <section aria-label="Today and this week" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat value={s.people} label="People" note={`${s.papersTotal.toLocaleString()} papers · ${s.thoughtsTotal.toLocaleString()} thoughts`} />
        <Stat value={s.activeToday} label="Wrote today" note={`${s.thoughtsToday.toLocaleString()} thoughts today`} />
        <Stat value={s.activeWeek} label="Wrote this week" note={`${pct(s.activeWeek, s.people)} of everyone · ${s.activeMonth} this month`} />
        <Stat value={perActive} label="Thoughts per person, week" note={`${s.thoughtsWeek.toLocaleString()} thoughts in 7 days`} />
      </section>

      <section aria-label="The last 30 days" className={`${card} grid gap-8 lg:grid-cols-2`}>
        <Bars title="Thoughts per day, last 30 days" data={daily} unit="thoughts" />
        <Bars title="People writing per day" data={dailyPeople} unit="people" />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <section aria-labelledby="sources" className={`${card} flex flex-col gap-4`}>
          <h2 id="sources" className="flex items-baseline justify-between">
            <span className="font-hand text-[28px] leading-none font-bold">Where thoughts come from</span>
            <span className="text-[13px] text-mute">this week</span>
          </h2>
          <SourceBars data={sources} />
          <p className="text-[12px] text-mute">Read from each thought&apos;s id: the extension, the Mac app, the quick box and phone shares each name their own.</p>
        </section>

        <section aria-labelledby="habit" className={`${card} flex flex-col gap-4`}>
          <h2 id="habit" className="font-hand text-[28px] leading-none font-bold">
            Habit
          </h2>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-[13px] text-mute">Came back another day</dt>
              <dd className="text-[28px] font-semibold tabular-nums">
                {s.returning} <span className="text-[15px] font-normal text-mute">· {pct(s.returning, s.people)}</span>
              </dd>
            </div>
            <div>
              <dt className="text-[13px] text-mute">Weekly / monthly writers</dt>
              <dd className="text-[28px] font-semibold tabular-nums">{pct(s.activeWeek, s.activeMonth)}</dd>
            </div>
            <div>
              <dt className="text-[13px] text-mute">Tonight reviews, 7 days</dt>
              <dd className="text-[28px] font-semibold tabular-nums">{s.reviewsWeek}</dd>
            </div>
            <div>
              <dt className="text-[13px] text-mute">Never wrote a thought</dt>
              <dd className="text-[28px] font-semibold tabular-nums">{s.people_.filter((p) => p.thoughts === 0).length}</dd>
            </div>
          </dl>
          <p className="text-[12px] text-mute">Weekly / monthly above 50% means people use it most weeks, not once.</p>
        </section>
      </div>

      <section aria-label="Every month" className={`${card} grid gap-8 lg:grid-cols-2`}>
        <Bars title="New people per month" data={monthlyPeople} unit="people" height={130} />
        <Bars title="Thoughts per month" data={monthlyThoughts} unit="thoughts" height={130} />
      </section>

      <section aria-labelledby="people" className={`${card} flex flex-col gap-4`}>
        <h2 id="people" className="flex items-baseline justify-between">
          <span className="font-hand text-[28px] leading-none font-bold">People</span>
          <span className="text-[13px] text-mute">most recently active first</span>
        </h2>
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[14px] tabular-nums">
            <thead className="text-[12px] text-mute">
              <tr className="border-b border-line">
                <th className="px-2 py-2 font-medium">Person</th>
                <th className="px-2 py-2 font-medium">Joined</th>
                <th className="px-2 py-2 font-medium">Last active</th>
                <th className="px-2 py-2 text-right font-medium">Thoughts</th>
                <th className="px-2 py-2 text-right font-medium">Papers</th>
                <th className="px-2 py-2 font-medium">Signs in with</th>
              </tr>
            </thead>
            <tbody>
              {s.people_.map((p) => (
                <tr key={p.id} className="border-b border-line/60 last:border-0">
                  <td className="px-2 py-2.5">
                    <span className="flex flex-col">
                      <span className="font-medium">{p.name}</span>
                      <span className="text-[13px] text-mute">{p.email}</span>
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-mute">{new Date(p.joined).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
                  <td className="px-2 py-2.5">{ago(p.lastActive)}</td>
                  <td className="px-2 py-2.5 text-right">{p.thoughts.toLocaleString()}</td>
                  <td className="px-2 py-2.5 text-right">{p.papers}</td>
                  <td className="px-2 py-2.5 text-mute capitalize">{p.signIn.join(", ") || "email link"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <p className="text-center text-[12px] text-mute">Days and months in {s.zone}. &ldquo;Active&rdquo; means wrote a thought.</p>
    </main>
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
      <main className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
        <h1 className="font-hand text-[40px] leading-none font-bold">Studio is off</h1>
        <p className="text-mute">Set STUDIO_PASSCODE on the server to switch it on.</p>
      </main>
    );
  }
  // Lock two, the passcode.
  if (!(await studioOpen(admin.id))) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 pb-24 text-center">
        <span className="flex flex-col gap-2">
          <h1 className="font-hand text-[44px] leading-none font-bold">Studio</h1>
          <span className="text-[14px] text-mute">Hi {admin.name.split(" ")[0]}. Type the Studio passcode.</span>
        </span>
        <GateForm />
      </main>
    );
  }
  const stats = await studioStats();
  return (
    <>
      <div className="mx-auto flex w-full max-w-[1120px] items-center justify-between px-4 pt-2 sm:px-8">
        <h1 className="font-hand text-[34px] leading-none font-bold">How it&apos;s going</h1>
        <form action={leave}>
          <button type="submit" className="h-9 rounded-lg px-3 text-sm font-medium text-mute hover:bg-soft hover:text-ink">
            Lock Studio
          </button>
        </form>
      </div>
      <Dashboard s={stats} />
    </>
  );
}

/** /studio: for the admin account, with its passcode. The numbers that say whether Pen & Paper is becoming a habit. */
export default function StudioPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <nav className="mx-auto flex h-16 w-full max-w-[1120px] items-center px-4 sm:px-8">
        <Link href="/drop" aria-label="Back to my paper" className="rounded-sm">
          <Logo size="sm" />
        </Link>
      </nav>
      <Suspense fallback={<div className="flex-1" aria-busy="true" />}>
        <Studio />
      </Suspense>
    </div>
  );
}
