import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { readLabel } from "@/modules/stories/logic";
import { rate, SOURCE_LABEL, usual, type Source } from "@/modules/stories/reach";
import { allReach, clapsByStory, storyNumbers } from "@/modules/stories/reach-server";
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
  const [list, numbers, all, claps] = await Promise.all([allStories(), storyNumbers(), allReach(), clapsByStory()]);
  const byId = new Map(numbers.map((x) => [x.id, x]));
  // Everyone who read anything, and how many of them read more than one story: the audience, not the traffic.
  const readers = all.readers;
  const returning = numbers.reduce((t, x) => t + x.returning, 0);
  const usualFinish = usual(numbers, (x) => rate(x.finished, x.readers));
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
      <section aria-label="All stories" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: "Readers", value: n(readers), note: all.topSource ? `most from ${SOURCE_LABEL[all.topSource as Source] ?? all.topSource}` : "different people, all stories" },
          { label: "Came back", value: n(returning), note: "reads by people who'd read you before" },
          { label: "Your usual finish", value: usualFinish === null ? "—" : `${usualFinish}%`, note: usualFinish === null ? "after 3 stories with 10+ readers" : "median story, read to the end" },
        ].map((k) => (
          <div key={k.label} className="flex flex-col gap-1 rounded-2xl border border-line bg-sheet p-4">
            <span className="text-[12px] font-medium text-mute">{k.label}</span>
            <span className="text-[26px] leading-none font-semibold tracking-[-0.02em] [font-feature-settings:'tnum'_1]">{k.value}</span>
            <span className="text-[12px] text-mute">{k.note}</span>
          </div>
        ))}
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
              {s.state === "published" && (() => {
                const x = byId.get(s.id);
                const fin = x ? rate(x.finished, x.readers) : 0;
                const better = usualFinish !== null && x && x.readers >= 10 ? fin - usualFinish : null;
                return (
                  <span className="flex shrink-0 gap-5 text-right text-[13px] text-mute [font-feature-settings:'tnum'_1]">
                    <span className="flex flex-col">
                      <span className="text-[15px] font-semibold text-ink">{n(x?.readers ?? 0)}</span>readers
                    </span>
                    <span className="flex flex-col">
                      <span className="text-[15px] font-semibold text-ink">
                        {fin}%
                        {better !== null && better !== 0 && (
                          <span className="ml-1 text-[12px]" style={{ color: better > 0 ? "var(--studio-up)" : "var(--studio-down)" }}>
                            {better > 0 ? "▲" : "▼"}
                          </span>
                        )}
                      </span>
                      finished
                    </span>
                    <span className="flex flex-col max-sm:hidden">
                      <span className="text-[15px] font-semibold text-ink">{x ? `${rate(x.returning, x.readers)}%` : "0%"}</span>came back
                    </span>
                    <span className="flex flex-col max-sm:hidden">
                      <span className="text-[15px] font-semibold text-ink">{n(claps[s.id]?.people ?? 0)}</span>clapped
                    </span>
                  </span>
                );
              })()}
            </Link>
            {s.state === "published" && (
              <span className="flex items-center justify-between border-t border-line/60 px-5 py-2 text-[13px] text-mute">
                <Link href={`/studio/stories/${s.id}/reach`} className="hover:text-ink">
                  Where readers stop, and your top fans →
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
