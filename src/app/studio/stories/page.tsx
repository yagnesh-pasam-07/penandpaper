import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { readLabel } from "@/modules/stories/logic";
import { CHANNEL_LABEL, readThrough, SOURCE_LABEL, type Channel, type Source } from "@/modules/stories/reach";
import { allReach, clapsByStory, totalsByStory } from "@/modules/stories/reach-server";
import { allStories } from "@/modules/stories/server";
import { writerOrPage } from "@/modules/stories/studio-gate";
import { newStory } from "./actions";
import { ImportForm } from "./import-form";
import { StudioShell } from "../shell";

export const metadata: Metadata = { title: "Stories · Studio", robots: { index: false, follow: false } };

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "");
const DOT = { draft: "bg-line", scheduled: "bg-amber", published: "bg-green" } as const;
const WORD = { draft: "Draft", scheduled: "Scheduled", published: "Published" } as const;

async function List() {
  await connection();
  const writer = await writerOrPage("/studio/stories");
  if (!writer || typeof writer !== "object" || !("id" in writer)) return writer;
  const [list, totals, all, claps] = await Promise.all([allStories(), totalsByStory(), allReach(), clapsByStory()]);
  const n = (v: number) => v.toLocaleString("en-IN");
  const rail = list.filter((s) => s.state === "published").map((s) => ({ id: s.id, title: s.title }));
  return (
    <StudioShell
      section="stories"
      title="Stories"
      subtitle="Write, schedule one a week, and see them at /stories."
      stories={rail}
      actions={
        <form action={newStory}>
          <button type="submit" className="h-10 rounded-full bg-ink px-5 text-[14px] font-semibold text-bg">
            Write a story
          </button>
        </form>
      }
    >
      <section aria-label="All stories" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Views", value: n(all.views) },
          { label: "Readers", value: n(all.readers) },
          { label: "Read to the end", value: `${readThrough(all)}%` },
          { label: "Shares", value: n(all.shares), note: all.topChannel ? `most on ${CHANNEL_LABEL[all.topChannel as Channel] ?? all.topChannel}` : undefined },
        ].map((k) => (
          <div key={k.label} className="flex flex-col gap-1 rounded-2xl border border-line bg-sheet p-4">
            <span className="text-[12px] font-medium text-mute">{k.label}</span>
            <span className="text-[26px] leading-none font-semibold tracking-[-0.02em] [font-feature-settings:'tnum'_1]">{k.value}</span>
            {k.note && <span className="text-[12px] text-mute">{k.note}</span>}
          </div>
        ))}
        {all.topSource && <p className="col-span-full text-[13px] text-mute">Most readers come from {SOURCE_LABEL[all.topSource as Source] ?? all.topSource}.</p>}
      </section>
      <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-sheet">
        {list.length === 0 && <li className="px-5 py-10 text-center text-mute">No stories yet.</li>}
        {list.map((s) => (
          <li key={s.id}>
            {/* A live story opens its own page (numbers, who clapped); a draft opens the editor. */}
            <Link href={s.state === "published" ? `/studio/stories/${s.id}/reach` : `/studio/stories/${s.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-soft">
              <span className={`size-2.5 shrink-0 rounded-full ${DOT[s.state]}`} aria-hidden="true" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[16px] font-medium">{s.title || "Untitled"}</span>
                <span className="text-[13px] text-mute">
                  {WORD[s.state]}
                  {s.state !== "draft" ? ` · ${when(s.publishAt)}` : ` · edited ${when(s.updatedAt)}`} · {readLabel(s.readingMinutes)}
                </span>
              </span>
              {s.state === "published" && (
                <span className="flex shrink-0 gap-4 text-right text-[13px] text-mute [font-feature-settings:'tnum'_1]">
                  <span className="flex flex-col">
                    <span className="text-[15px] font-semibold text-ink">{n(totals[s.id]?.views ?? 0)}</span>views
                  </span>
                  <span className="flex flex-col max-sm:hidden">
                    <span className="text-[15px] font-semibold text-ink">{totals[s.id] ? `${readThrough(totals[s.id])}%` : "0%"}</span>read
                  </span>
                  <span className="flex flex-col">
                    <span className="text-[15px] font-semibold text-ink">{n(totals[s.id]?.shares ?? 0)}</span>shares
                  </span>
                  <span className="flex flex-col">
                    <span className="text-[15px] font-semibold text-ink">{n(claps[s.id]?.claps ?? 0)}</span>claps
                  </span>
                  <span className="flex flex-col max-sm:hidden">
                    <span className="text-[15px] font-semibold text-ink">{n(claps[s.id]?.people ?? 0)}</span>clapped
                  </span>
                </span>
              )}
            </Link>
            {s.state === "published" && (
              <span className="flex items-center justify-between border-t border-line/60 px-5 py-2 text-[13px] text-mute">
                <Link href={`/studio/stories/${s.id}/reach`} className="hover:text-ink">
                  Open its numbers: who clapped, where readers stop, where it was shared →
                </Link>
                <Link href={`/studio/stories/${s.id}`} className="hover:text-ink">
                  Edit
                </Link>
              </span>
            )}
          </li>
        ))}
      </ul>
      <ImportForm />
    </StudioShell>
  );
}

export default function StudioStoriesPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg" aria-busy="true" />}>
      <List />
    </Suspense>
  );
}
