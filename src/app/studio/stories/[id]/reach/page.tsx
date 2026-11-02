import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { readLabel, storyDate } from "@/modules/stories/logic";
import {
  averageRead,
  biggestDrop,
  CHANNEL_LABEL,
  daily,
  duration,
  MAX_CLAPS,
  mean,
  median,
  readThrough,
  retention,
  shareRate,
  SOURCE_LABEL,
  type Channel,
  type Source,
} from "@/modules/stories/reach";
import { blockText, parse } from "@/modules/stories/markdown";
import {
  clappers,
  clapSummary,
  storyAttention,
  storyReach,
} from "@/modules/stories/reach-server";
import { liveStoriesForRail, storyForWriter } from "@/modules/stories/server";
import { writerOrPage } from "@/modules/stories/studio-gate";
import { Bars } from "../../../charts";
import { Retention } from "./retention";
import { StudioShell } from "../../../shell";

export const metadata: Metadata = {
  title: "Reach · Studio",
  robots: { index: false, follow: false },
};

const card = "rounded-2xl border border-line bg-sheet";
const fmt = (n: number) => n.toLocaleString("en-IN");

function Kpi({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className={`${card} flex flex-col gap-1.5 p-5`}>
      <span className="text-[13px] font-medium text-mute">{label}</span>
      <span className="text-[32px] leading-none font-semibold tracking-[-0.02em]">
        {value}
      </span>
      {note && <span className="text-[12px] text-mute">{note}</span>}
    </div>
  );
}

/** A ranked list with a bar each, biggest first: where readers came from, where it was shared. */
function Ranked({
  title,
  rows,
  unit,
  empty,
}: {
  title: string;
  rows: { label: string; value: number }[];
  unit: string;
  empty: string;
}) {
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
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${(r.value / top) * 100}%`,
                    background: "var(--studio-blue)",
                  }}
                />
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
  const [r, fans, att, cl, rail] = await Promise.all([
    storyReach(id).catch(() => null),
    clappers(id),
    storyAttention(id).catch(() => null),
    clapSummary(id),
    liveStoriesForRail(),
  ]);
  if (!r)
    return (
      <p className="p-10 text-center text-mute">
        Numbers aren&apos;t available yet.
      </p>
    );
  const days = daily(r.daily, 28, new Date());
  const sources = Object.entries(r.bySource)
    .map(([k, v]) => ({ label: SOURCE_LABEL[k as Source] ?? k, value: v }))
    .sort((a, b) => b.value - a.value);
  const channels = Object.entries(r.byChannel)
    .map(([k, v]) => ({ label: CHANNEL_LABEL[k as Channel] ?? k, value: v }))
    .sort((a, b) => b.value - a.value);
  const blocks = parse(s.body);
  const curve = att ? retention(att.depths, blocks.length, r.readers) : [];
  const drop = biggestDrop(curve);
  const points = blocks.map((b, i) => ({
    pct: curve[i] ?? 0,
    kind: b.t,
    preview: blockText(b),
  }));
  const halfway = curve.length ? curve[Math.floor((curve.length - 1) / 2)] : 0;
  const typical = att ? median(att.seconds) : 0;
  const finisher = att ? median(att.finishedSeconds) : 0;
  const estimate = s.readingMinutes * 60;
  const pace =
    finisher && estimate ? Math.round((finisher / estimate) * 100) : 0;
  const quality = (att?.bySource ?? [])
    .filter((x) => x.readers > 0)
    .map((x) => ({
      label: SOURCE_LABEL[x.source as Source] ?? x.source,
      readers: x.readers,
      pct: Math.round((x.finished / x.readers) * 100),
    }));
  const avgRead = att ? averageRead(att.depths, blocks.length) : 0;
  const avgSeconds = att ? mean(att.seconds) : 0;
  const phone = r.byDevice.phone ?? 0;
  const people = phone + (r.byDevice.desktop ?? 0);
  return (
    <StudioShell
      section={{ story: id }}
      stories={rail}
      title={s.title || "Untitled"}
      subtitle={`${s.state === "published" ? `Published ${storyDate(s.publishAt)}` : s.state === "scheduled" ? "Scheduled" : "Draft"} · ${readLabel(s.readingMinutes)}`}
      actions={
        <>
          <Link
            href={`/studio/stories/${id}`}
            className="flex h-9 items-center rounded-full border border-line px-4 text-[14px] hover:bg-soft"
          >
            Edit
          </Link>
          {s.state === "published" && (
            <Link
              href={`/stories/${s.slug}`}
              target="_blank"
              className="flex h-9 items-center rounded-full border border-line px-4 text-[14px] hover:bg-soft"
            >
              View ↗
            </Link>
          )}
        </>
      }
    >
      {/* The headline, like YouTube Studio's: did it hold people, and how long. */}
      <section className={`${card} grid grid-cols-2 gap-5 p-5 sm:grid-cols-4`}>
        {[
          {
            label: "Average attention",
            value: avgSeconds ? duration(avgSeconds) : "—",
            note: estimate
              ? `of a ${duration(estimate)} read`
              : "time actually reading",
          },
          {
            label: "Average read",
            value: att && att.depths.length ? `${avgRead}%` : "—",
            note: "of the story, per reader",
          },
          {
            label: "Finished it",
            value: `${readThrough(r)}%`,
            note: `${fmt(r.reads)} of ${fmt(r.readers)} readers`,
          },
          {
            label: "Clapped",
            value: r.readers
              ? `${Math.round((cl.people / r.readers) * 100)}%`
              : "—",
            note: `${fmt(cl.people)} people, ${fmt(cl.total)} claps`,
          },
        ].map((k) => (
          <div key={k.label} className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-mute">{k.label}</span>
            <span className="text-[34px] leading-none font-semibold tracking-[-0.02em]">
              {k.value}
            </span>
            <span className="text-[12px] text-mute">{k.note}</span>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Kpi
          label="Views"
          value={fmt(r.views)}
          note="opened, once a day per reader"
        />
        <Kpi label="Readers" value={fmt(r.readers)} note="different people" />
        <Kpi
          label="Read to the end"
          value={`${readThrough(r)}%`}
          note={`${fmt(r.reads)} finished it`}
        />
        <Kpi
          label="Shares"
          value={fmt(r.shares)}
          note={`${shareRate(r)} per 100 readers`}
        />
        <Kpi
          label="Claps"
          value={fmt(s.claps)}
          note={
            cl.people
              ? `from ${fmt(cl.people)} ${cl.people === 1 ? "person" : "people"}`
              : "no claps yet"
          }
        />
        <Kpi
          label="Listens"
          value={fmt(r.listens)}
          note={s.audioId ? "pressed Listen" : "no recording yet"}
        />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <section className={`${card} flex flex-col gap-4 p-5`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[15px] font-semibold">Where readers stop</h2>
              <span className="text-[13px] text-mute">
                {att && att.depths.length
                  ? `${fmt(att.depths.length)} readers tracked`
                  : "Counting starts with the next reader"}
              </span>
            </div>
            {att && att.depths.length > 0 ? (
              <>
                <p className="text-[15px] leading-relaxed">
                  {drop ? (
                    <>
                      The biggest drop is after{" "}
                      <span className="font-semibold">
                        paragraph {drop.after + 1}
                      </span>
                      : {drop.lost}% of readers stop there. {halfway}% reach the
                      middle, {curve[curve.length - 1] ?? 0}% reach the last
                      paragraph.
                    </>
                  ) : (
                    <>
                      Readers stay with it: no single paragraph loses many
                      people. {curve[curve.length - 1] ?? 0}% reach the last
                      paragraph.
                    </>
                  )}
                </p>
                <div className="pl-8">
                  <Retention
                    points={points}
                    dropAt={drop ? drop.after + 1 : null}
                  />
                </div>
              </>
            ) : (
              <p className="text-[14px] text-mute">
                Each reader&apos;s furthest paragraph is counted from now on.
                The curve appears after the first few readers.
              </p>
            )}
          </section>
          <div className="grid gap-3 md:grid-cols-3">
            <Kpi
              label="Typical reading time"
              value={typical ? duration(typical) : "—"}
              note="median active time, tab open and scrolling"
            />
            <Kpi
              label="Finishers took"
              value={finisher ? duration(finisher) : "—"}
              note={
                estimate
                  ? `estimate ${duration(estimate)}${pace ? ` · ${pace}% of it` : ""}`
                  : "no estimate"
              }
            />
            <Kpi
              label="Reach the middle"
              value={curve.length ? `${halfway}%` : "—"}
              note="of everyone who opened it"
            />
          </div>
          <section className={`${card} flex flex-col gap-3 p-5`}>
            <h2 className="text-[15px] font-semibold">Views, last 28 days</h2>
            <Bars
              data={days.map((d) => ({
                label: d.day,
                short: d.day.slice(8),
                value: d.views,
              }))}
              unit="views"
            />
          </section>
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <section id="claps" className={`${card} flex flex-col gap-5 p-5`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[15px] font-semibold">Who clapped</h2>
              <span className="text-[13px] text-mute">
                {cl.people
                  ? `${fmt(cl.total)} claps from ${fmt(cl.people)} ${cl.people === 1 ? "person" : "people"}`
                  : "No claps yet"}
              </span>
            </div>
            {cl.people > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "People", value: fmt(cl.people) },
                  {
                    label: "Claps each",
                    value: (cl.total / cl.people).toFixed(1),
                    note: `of ${MAX_CLAPS} possible`,
                  },
                  {
                    label: "Gave all 50",
                    value: fmt(cl.full),
                    note: cl.full ? "moved the most" : undefined,
                  },
                  {
                    label: "Clapped, of readers",
                    value: r.readers
                      ? `${Math.round((cl.people / r.readers) * 100)}%`
                      : "—",
                  },
                ].map((k) => (
                  <div
                    key={k.label}
                    className="flex flex-col gap-1 rounded-xl bg-soft p-3"
                  >
                    <span className="text-[12px] text-mute">{k.label}</span>
                    <span className="text-[22px] leading-none font-semibold">
                      {k.value}
                    </span>
                    {k.note && (
                      <span className="text-[11px] text-mute">{k.note}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {fans.length === 0 ? (
              <p className="text-[14px] text-mute">
                {cl.people
                  ? "Claps from before sign-in was required have no name."
                  : "When a signed-in reader claps, their name appears here."}
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-line/70">
                {fans.map((f, i) => (
                  <li key={i} className="flex items-center gap-3 py-2.5">
                    {f.image ? (
                      // eslint-disable-next-line @next/next/no-img-element -- the reader's Google photo, small
                      <img
                        src={f.image}
                        alt=""
                        width={32}
                        height={32}
                        referrerPolicy="no-referrer"
                        className="size-8 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-soft text-[13px] font-semibold">
                        {f.name.trim().charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[14px] font-medium">
                        {f.name}
                      </span>
                      <span className="truncate text-[12px] text-mute">
                        {f.email} ·{" "}
                        {new Date(f.at).toLocaleString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "numeric",
                          minute: "2-digit",
                          timeZone: "Asia/Kolkata",
                        })}
                      </span>
                    </span>
                    <span className="flex w-28 shrink-0 items-center gap-2 max-sm:w-16">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-soft max-sm:hidden">
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${(f.count / MAX_CLAPS) * 100}%`,
                            background: "var(--studio-blue)",
                          }}
                        />
                      </span>
                      <span className="w-8 text-right text-[14px] font-semibold">
                        {f.count}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {cl.people > cl.signedIn && fans.length > 0 && (
              <p className="text-[12px] text-mute">
                {fmt(cl.people - cl.signedIn)} more clapped before sign-in was
                required, so they have no name.
              </p>
            )}
          </section>
          <section className={`${card} flex flex-col gap-4 p-5`}>
            <h2 className="text-[15px] font-semibold">
              Who reads to the end, by where they came from
            </h2>
            {quality.length === 0 ? (
              <p className="text-[14px] text-mute">No readers yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {quality.map((q) => (
                  <li key={q.label} className="flex flex-col gap-1.5">
                    <span className="flex justify-between text-[14px]">
                      <span>{q.label}</span>
                      <span className="text-mute">
                        <span className="font-semibold text-ink">{q.pct}%</span>{" "}
                        of {fmt(q.readers)} finished
                      </span>
                    </span>
                    <span className="h-2 overflow-hidden rounded-full bg-soft">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${q.pct}%`,
                          background: "var(--studio-blue)",
                        }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Ranked
          title="Where readers came from"
          rows={sources}
          unit="readers"
          empty="No readers yet. Share it on WhatsApp to start."
        />
        <Ranked
          title="Where it was shared"
          rows={channels}
          unit="shares"
          empty="Nobody has shared it yet."
        />
      </div>
      <section className={`${card} flex flex-col gap-2 p-5`}>
        <h2 className="text-[15px] font-semibold">How they read</h2>
        <p className="text-[14px] text-mute">
          {people
            ? `${Math.round((phone / people) * 100)}% on a phone, ${100 - Math.round((phone / people) * 100)}% on a computer.`
            : "No readers yet."}
        </p>
      </section>

      <p className="text-[12px] text-mute">
        Anonymous: a reader is a random id their browser keeps (no cookie, no
        IP, no name), counted once a day per story. Depth is the furthest
        paragraph that came on screen; reading time counts only while the tab is
        open and the reader has moved in the last 30 seconds. Link-preview bots
        and crawlers aren&apos;t counted. Readers never see these numbers.
      </p>
    </StudioShell>
  );
}

export default function ReachPage(
  props: PageProps<"/studio/stories/[id]/reach">,
) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg" aria-busy="true" />}>
      <Reach params={props.params} />
    </Suspense>
  );
}
