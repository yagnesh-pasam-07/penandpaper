import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { Logo } from "@/components/ui";
import { readLabel, storyDate } from "@/modules/stories/logic";
import { CHANNEL_LABEL, daily, readThrough, shareRate, SOURCE_LABEL, type Channel, type Source } from "@/modules/stories/reach";
import { clappers, storyReach } from "@/modules/stories/reach-server";
import { storyForWriter } from "@/modules/stories/server";
import { writerOrPage } from "@/modules/stories/studio-gate";
import { Bars } from "../../../charts";

export const metadata: Metadata = { title: "Reach · Studio", robots: { index: false, follow: false } };

const studioVars = "[--studio-blue:#2a78d6] [[data-theme=dark]_&]:[--studio-blue:#3987e5]";
const numbers = "[font-family:var(--font-inter),var(--font-instrument),system-ui,sans-serif] [font-feature-settings:'tnum'_1]";
const card = "rounded-2xl border border-line bg-sheet";
const fmt = (n: number) => n.toLocaleString("en-IN");

function Kpi({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className={`${card} flex flex-col gap-1.5 p-5`}>
      <span className="text-[13px] font-medium text-mute">{label}</span>
      <span className="text-[32px] leading-none font-semibold tracking-[-0.02em]">{value}</span>
      {note && <span className="text-[12px] text-mute">{note}</span>}
    </div>
  );
}

/** A ranked list with a bar each, biggest first: where readers came from, where it was shared. */
function Ranked({ title, rows, unit, empty }: { title: string; rows: { label: string; value: number }[]; unit: string; empty: string }) {
  const top = Math.max(1, ...rows.map((r) => r.value));
  return (
    <section className={`${card} flex flex-col gap-4 p-5`}>
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-[14px] text-mute">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => (
            <li key={r.label} className="flex flex-col gap-1.5">
              <span className="flex justify-between text-[14px]">
                <span>{r.label}</span>
                <span className="text-mute">
                  {fmt(r.value)} {unit}
                </span>
              </span>
              <span className="h-2 overflow-hidden rounded-full bg-soft">
                <span className="block h-full rounded-full" style={{ width: `${(r.value / top) * 100}%`, background: "var(--studio-blue)" }} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

async function Reach({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const writer = await writerOrPage(`/studio/stories/${id}/reach`);
  if (!writer || typeof writer !== "object" || !("id" in writer)) return writer;
  if (!z.uuid().safeParse(id).success) notFound();
  const s = await storyForWriter(id);
  if (!s) notFound();
  const [r, fans] = await Promise.all([storyReach(id).catch(() => null), clappers(id)]);
  if (!r) return <p className="p-10 text-center text-mute">Numbers aren&apos;t available yet.</p>;
  const days = daily(r.daily, 28, new Date());
  const sources = Object.entries(r.bySource)
    .map(([k, v]) => ({ label: SOURCE_LABEL[k as Source] ?? k, value: v }))
    .sort((a, b) => b.value - a.value);
  const channels = Object.entries(r.byChannel)
    .map(([k, v]) => ({ label: CHANNEL_LABEL[k as Channel] ?? k, value: v }))
    .sort((a, b) => b.value - a.value);
  const phone = r.byDevice.phone ?? 0;
  const people = phone + (r.byDevice.desktop ?? 0);
  return (
    <main className="mx-auto flex w-full max-w-[1040px] flex-col gap-6 px-4 pt-8 pb-24 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Link href="/studio/stories" className="text-[13px] text-mute hover:text-ink">
            ← Stories
          </Link>
          <h1 className="text-[26px] font-semibold tracking-[-0.02em]">{s.title || "Untitled"}</h1>
          <p className="text-[14px] text-mute">
            {s.state === "published" ? `Published ${storyDate(s.publishAt)}` : s.state === "scheduled" ? "Scheduled" : "Draft"} · {readLabel(s.readingMinutes)}
          </p>
        </div>
        <span className="flex gap-2 text-[14px]">
          <Link href={`/studio/stories/${id}`} className="flex h-9 items-center rounded-full border border-line px-4 hover:bg-soft">
            Edit
          </Link>
          {s.state === "published" && (
            <Link href={`/stories/${s.slug}`} target="_blank" className="flex h-9 items-center rounded-full border border-line px-4 hover:bg-soft">
              View ↗
            </Link>
          )}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Kpi label="Views" value={fmt(r.views)} note="opened, once a day per reader" />
        <Kpi label="Readers" value={fmt(r.readers)} note="different people" />
        <Kpi label="Read to the end" value={`${readThrough(r)}%`} note={`${fmt(r.reads)} finished it`} />
        <Kpi label="Shares" value={fmt(r.shares)} note={`${shareRate(r)} per 100 readers`} />
        <Kpi label="Claps" value={fmt(s.claps)} note="up to 50 from each reader" />
        <Kpi label="Listens" value={fmt(r.listens)} note={s.audioId ? "pressed Listen" : "no recording yet"} />
      </div>

      <section className={`${card} flex flex-col gap-3 p-5`}>
        <h2 className="text-[15px] font-semibold">Views, last 28 days</h2>
        <Bars data={days.map((d) => ({ label: d.day, short: d.day.slice(8), value: d.views }))} unit="views" />
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        <Ranked title="Where readers came from" rows={sources} unit="readers" empty="No readers yet. Share it on WhatsApp to start." />
        <Ranked title="Where it was shared" rows={channels} unit="shares" empty="Nobody has shared it yet." />
      </div>

      <section className={`${card} flex flex-col gap-3 p-5`}>
        <h2 className="text-[15px] font-semibold">Who loved it</h2>
        {fans.length === 0 ? (
          <p className="text-[14px] text-mute">No claps from signed-in readers yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {fans.map((f, i) => (
              <li key={i} className="flex items-center gap-2 rounded-full border border-line py-1 pr-3 pl-1 text-[14px]">
                <span className="flex size-7 items-center justify-center rounded-full bg-soft text-[12px] font-semibold">{f.name.trim().charAt(0).toUpperCase()}</span>
                {f.name}
                <span className="text-mute">👏 {f.count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`${card} flex flex-col gap-2 p-5`}>
        <h2 className="text-[15px] font-semibold">How they read</h2>
        <p className="text-[14px] text-mute">{people ? `${Math.round((phone / people) * 100)}% on a phone, ${100 - Math.round((phone / people) * 100)}% on a computer.` : "No readers yet."}</p>
      </section>

      <p className="text-[12px] text-mute">
        Anonymous: a reader is a random id their browser keeps (no cookie, no IP, no name), counted once a day per story. Link-preview bots and crawlers aren&apos;t counted. Readers never see these numbers.
      </p>
    </main>
  );
}

export default function ReachPage(props: PageProps<"/studio/stories/[id]/reach">) {
  return (
    <div className={`flex min-h-dvh flex-col bg-bg ${studioVars} ${numbers}`}>
      <header className="border-b border-line">
        <div className="mx-auto flex h-14 w-full max-w-[1040px] items-center gap-3 px-4 sm:px-8">
          <Link href="/studio">
            <Logo size="sm" />
          </Link>
          <span className="text-[14px] text-mute">Story Studio</span>
        </div>
      </header>
      <Suspense fallback={<div className="flex-1" aria-busy="true" />}>
        <Reach params={props.params} />
      </Suspense>
    </div>
  );
}
