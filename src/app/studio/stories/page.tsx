import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Logo } from "@/components/ui";
import { readLabel } from "@/modules/stories/logic";
import { allStories } from "@/modules/stories/server";
import { writerOrPage } from "@/modules/stories/studio-gate";
import { newStory } from "./actions";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "Stories · Studio", robots: { index: false, follow: false } };

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "");
const DOT = { draft: "bg-line", scheduled: "bg-amber", published: "bg-green" } as const;
const WORD = { draft: "Draft", scheduled: "Scheduled", published: "Published" } as const;

async function List() {
  await connection();
  const writer = await writerOrPage("/studio/stories");
  if (!writer || typeof writer !== "object" || !("id" in writer)) return writer;
  const list = await allStories();
  return (
    <main className="mx-auto flex w-full max-w-[880px] flex-col gap-8 px-4 pt-8 pb-24 sm:px-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-[-0.02em]">Stories</h1>
          <p className="text-[14px] text-mute">Write, schedule one a week, and see them at /stories.</p>
        </div>
        <form action={newStory}>
          <button type="submit" className="h-11 rounded-full bg-ink px-5 text-[15px] font-semibold text-bg">
            Write a story
          </button>
        </form>
      </div>
      <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-sheet">
        {list.length === 0 && <li className="px-5 py-10 text-center text-mute">No stories yet.</li>}
        {list.map((s) => (
          <li key={s.id}>
            <Link href={`/studio/stories/${s.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-soft">
              <span className={`size-2.5 shrink-0 rounded-full ${DOT[s.state]}`} aria-hidden="true" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[16px] font-medium">{s.title || "Untitled"}</span>
                <span className="text-[13px] text-mute">
                  {WORD[s.state]}
                  {s.state !== "draft" ? ` · ${when(s.publishAt)}` : ` · edited ${when(s.updatedAt)}`} · {readLabel(s.readingMinutes)}
                </span>
              </span>
              {s.state === "published" && <span className="text-[13px] text-mute max-sm:hidden">/stories/{s.slug}</span>}
            </Link>
          </li>
        ))}
      </ul>
      <ImportForm />
    </main>
  );
}

export default function StudioStoriesPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="border-b border-line">
        <div className="mx-auto flex h-14 w-full max-w-[880px] items-center gap-3 px-4 sm:px-8">
          <Link href="/studio">
            <Logo size="sm" />
          </Link>
          <span className="text-[14px] text-mute">Studio</span>
          <Link href="/stories" className="ml-auto text-[14px] text-mute hover:text-ink">
            View /stories →
          </Link>
        </div>
      </header>
      <Suspense fallback={<div className="flex-1" aria-busy="true" />}>
        <List />
      </Suspense>
    </div>
  );
}
