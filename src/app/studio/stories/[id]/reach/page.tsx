import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { readLabel, storyDate } from "@/modules/stories/logic";
import { averageRead, biggestDrop, CHANNEL_LABEL, duration, MAX_CLAPS, median, rate, retention, SOURCE_LABEL, usual, type Channel, type Source } from "@/modules/stories/reach";
import { blockText, parse } from "@/modules/stories/markdown";
import { clappers, clapSummary, storyAttention, storyNumbers, storyReach } from "@/modules/stories/reach-server";
import { liveStoriesForRail, storyForWriter } from "@/modules/stories/server";
import { writerOrPage } from "@/modules/stories/studio-gate";
import { Retention } from "./retention";
import { StudioShell } from "../../../shell";

export const metadata: Metadata = {
  title: "Reach · Studio",
  robots: { index: false, follow: false },
};

const card = "rounded-2xl border border-line bg-sheet";
const fmt = (n: number) => n.toLocaleString("en-IN");

/** "▲ 12 vs your usual 48%": how this story compares with the median of the others. Quiet when there's nothing fair to compare with. */
function VsUsual({ now, usual }: { now: number; usual: number | null }) {
  if (usual === null) return <span className="text-[12px] text-mute">Your usual shows after 3 stories with 10+ readers</span>;
  const d = now - usual;
  return (
    <span className="flex items-center gap-1.5 text-[12px]">
      <span className="font-semibold" style={{ color: d === 0 ? undefined : d > 0 ? "var(--studio-up)" : "var(--studio-down)" }}>
        {d === 0 ? "→ same" : `${d > 0 ? "▲" : "▼"} ${Math.abs(d)} pts`}
      </span>
      <span className="text-mute">vs your usual {usual}%</span>
    </span>
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
  const [r, fans, att, cl, rail, all] = await Promise.all([
    storyReach(id).catch(() => null),
    clappers(id, 10),
    storyAttention(id).catch(() => null),
    clapSummary(id),
    liveStoriesForRail(),
    storyNumbers(),
  ]);
  if (!r)
    return (
      <p className="p-10 text-center text-mute">
        Numbers aren&apos;t available yet.
      </p>
    );
  const me = all.find((x) => x.id === id) ?? { id, readers: r.readers, week1: r.readers, pastOpening: 0, finished: r.reads, returning: 0 };
  const others = all.filter((x) => x.id !== id);
  const blocks = parse(s.body);
  const curve = att ? retention(att.depths, blocks.length, r.readers) : [];
  const drop = biggestDrop(curve);
  const points = blocks.map((b, i) => ({ pct: curve[i] ?? 0, kind: b.t, preview: blockText(b) }));
  const tracked = !!att && att.depths.length > 0;
  const avgRead = tracked ? averageRead(att.depths, blocks.length) : 0;
  const typical = att ? median(att.seconds) : 0;
  const estimate = s.readingMinutes * 60;

  // The four that decide what to write next, each against the writer's usual story.
  const finishedPct = rate(me.finished, me.readers);
  const openingPct = rate(me.pastOpening, me.readers);
  const returningPct = rate(me.returning, me.readers);
  const headline = [
    {
      label: "Readers",
      value: fmt(me.readers),
      note: <span className="text-[12px] text-mute">{fmt(me.week1)} in its first week{r.listens ? ` · ${fmt(r.listens)} listened` : ""}</span>,
    },
    {
      label: "Past the opening",
      value: tracked ? `${openingPct}%` : "—",
      note: <VsUsual now={openingPct} usual={usual(others, (x) => rate(x.pastOpening, x.readers))} />,
      help: "Reached the third paragraph: did the title and first lines hold them?",
    },
    {
      label: "Finished it",
      value: `${finishedPct}%`,
      note: <VsUsual now={finishedPct} usual={usual(others, (x) => rate(x.finished, x.readers))} />,
      help: tracked ? `Average read ${avgRead}% · typical ${typical ? duration(typical) : "—"}${estimate ? ` of a ${duration(estimate)} read` : ""}` : undefined,
    },
    {
      label: "Came back",
      value: `${returningPct}%`,
      note: <VsUsual now={returningPct} usual={usual(others, (x) => rate(x.returning, x.readers))} />,
      help: "Had read one of your stories before: your audience, not passers-by.",
    },
  ];

  // One table: who each place sends, and whether they stay.
  const sources = (att?.bySource ?? [])
    .filter((x) => x.readers > 0)
    .map((x) => ({ label: SOURCE_LABEL[x.source as Source] ?? x.source, readers: x.readers, pct: rate(x.finished, x.readers) }));
  const topChannel = Object.entries(r.byChannel).sort((a, b) => b[1] - a[1])[0];
  const phone = r.byDevice.phone ?? 0;
  const devices = phone + (r.byDevice.desktop ?? 0);

  return (
    <StudioShell
      section={{ story: id }}
      stories={rail}
      title={s.title || "Untitled"}
      subtitle={`${s.state === "published" ? `Published ${storyDate(s.publishAt)}` : s.state === "scheduled" ? "Scheduled" : "Draft"} · ${readLabel(s.readingMinutes)}`}
      actions={
        <>
          <Link href={`/studio/stories/${id}`} className="flex h-9 items-center rounded-full border border-line px-4 text-[14px] hover:bg-soft">
            Edit
          </Link>
          {s.state === "published" && (
            <Link href={`/stories/${s.slug}`} target="_blank" className="flex h-9 items-center rounded-full border border-line px-4 text-[14px] hover:bg-soft">
              View ↗
            </Link>
          )}
        </>
      }
    >
      <section className={`${card} grid grid-cols-2 gap-5 p-5 lg:grid-cols-4`}>
        {headline.map((k) => (
          <div key={k.label} className="flex flex-col gap-1.5" title={k.help}>
            <span className="text-[13px] font-medium text-mute">{k.label}</span>
            <span className="text-[34px] leading-none font-semibold tracking-[-0.02em]">{k.value}</span>
            {k.note}
            {k.help && <span className="text-[12px] leading-snug text-mute">{k.help}</span>}
          </div>
        ))}
      </section>

      <section className={`${card} flex flex-col gap-4 p-5`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[15px] font-semibold">Where readers stop</h2>
          <span className="text-[13px] text-mute">{tracked ? `${fmt(att.depths.length)} readers tracked` : "Counting starts with the next reader"}</span>
        </div>
        {tracked ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[15px] leading-relaxed">
                {drop ? (
                  <>
                    The biggest drop is after <span className="font-semibold">paragraph {drop.after + 1}</span>: {drop.lost}% of readers stop there. {curve[curve.length - 1] ?? 0}% reach the end.
                  </>
                ) : (
                  <>Readers stay with it: no single paragraph loses many people. {curve[curve.length - 1] ?? 0}% reach the end.</>
                )}
              </p>
              {drop && (
                <Link href={`/studio/stories/${id}?p=${drop.after}`} className="flex h-9 shrink-0 items-center rounded-full bg-ink px-4 text-[14px] font-semibold text-bg">
                  Open paragraph {drop.after + 1} in the editor
                </Link>
              )}
            </div>
            <div className="pl-8">
              <Retention points={points} dropAt={drop ? drop.after + 1 : null} />
            </div>
          </>
        ) : (
          <p className="text-[14px] text-mute">Each reader&apos;s furthest paragraph is counted from now on. The curve appears after the first few readers.</p>
        )}
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <section className={`${card} flex flex-col gap-4 p-5`}>
          <h2 className="text-[15px] font-semibold">Where readers came from, and who stayed</h2>
          {sources.length === 0 ? (
            <p className="text-[14px] text-mute">No readers yet. Share it on WhatsApp to start.</p>
          ) : (
            <table className="w-full text-left text-[14px] tabular-nums">
              <thead className="text-[12px] text-mute">
                <tr className="border-b border-line">
                  <th className="py-2 font-medium">Source</th>
                  <th className="py-2 text-right font-medium">Readers</th>
                  <th className="py-2 pl-4 font-medium">Finished</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((q) => (
                  <tr key={q.label} className="border-b border-line/60 last:border-0">
                    <td className="py-2.5">{q.label}</td>
                    <td className="py-2.5 text-right">{fmt(q.readers)}</td>
                    <td className="py-2.5 pl-4">
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-20 overflow-hidden rounded-full bg-soft">
                          <span className="block h-full rounded-full" style={{ width: `${q.pct}%`, background: "var(--studio-blue)" }} />
                        </span>
                        <span className="font-semibold">{q.pct}%</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="text-[12px] text-mute">
            {fmt(r.shares)} {r.shares === 1 ? "share" : "shares"}
            {topChannel ? `, most on ${CHANNEL_LABEL[topChannel[0] as Channel] ?? topChannel[0]}` : ""}
            {devices ? ` · ${Math.round((phone / devices) * 100)}% read on a phone` : ""}
          </p>
        </section>

        <section id="claps" className={`${card} flex flex-col gap-4 p-5`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[15px] font-semibold">Top fans</h2>
            <span className="text-[13px] text-mute">
              {cl.people ? `${fmt(cl.people)} ${cl.people === 1 ? "person" : "people"} clapped${r.readers ? ` (${rate(cl.people, r.readers)}% of readers)` : ""} · ${fmt(cl.total)} claps` : "No claps yet"}
            </span>
          </div>
          {fans.length === 0 ? (
            <p className="text-[14px] text-mute">When a signed-in reader claps, their name appears here. Write back to the first few: that&apos;s how readers become an audience.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line/70">
              {fans.map((f, i) => (
                <li key={i} className="flex items-center gap-3 py-2.5">
                  {f.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- the reader's Google photo, small
                    <img src={f.image} alt="" width={32} height={32} referrerPolicy="no-referrer" className="size-8 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-soft text-[13px] font-semibold">{f.name.trim().charAt(0).toUpperCase()}</span>
                  )}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[14px] font-medium">{f.name}</span>
                    <a href={`mailto:${f.email}`} className="truncate text-[12px] text-mute hover:text-ink">
                      {f.email}
                    </a>
                  </span>
                  <span className="text-[14px] font-semibold tabular-nums">
                    {f.count}
                    <span className="font-normal text-mute">/{MAX_CLAPS}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {cl.signedIn > fans.length && <p className="text-[12px] text-mute">Top {fans.length} of {fmt(cl.signedIn)} signed-in clappers.</p>}
        </section>
      </div>

      <p className="text-[12px] text-mute">
        Anonymous: a reader is a random id their browser keeps (no cookie, no IP, no name). &ldquo;Past the opening&rdquo; is reaching the third paragraph; &ldquo;came back&rdquo; is having opened another of your stories first. &ldquo;Your usual&rdquo; is the median of your other stories with 10+ readers. Bots aren&apos;t counted. Readers never see these numbers.
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
