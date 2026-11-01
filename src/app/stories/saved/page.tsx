import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { StoriesShell } from "@/modules/stories/chrome";
import { readLabel } from "@/modules/stories/logic";
import { savedStories } from "@/modules/stories/reach-server";
import { Picture } from "@/modules/stories/reader";
import { currentUser } from "@/server/session";

export const metadata: Metadata = { title: "Saved · Pen & Paper Stories", robots: { index: false, follow: false } };

/** The reader's own list of stories saved for later. */
async function Saved() {
  await connection();
  const user = await currentUser();
  if (!user)
    return (
      <p className="story-serif py-16 text-center text-[19px] text-mute">
        <Link href="/login?next=/stories/saved" className="text-ink underline underline-offset-4">
          Sign in
        </Link>{" "}
        to see the stories you saved.
      </p>
    );
  const list = await savedStories(user.id).catch(() => []);
  if (!list.length) return <p className="story-serif py-16 text-center text-[19px] text-mute italic">Nothing saved yet. Tap the bookmark on any story to keep it here.</p>;
  return (
    <ul className="flex flex-col divide-y divide-line">
      {list.map((s) => (
        <li key={s.slug}>
          <Link href={`/stories/${s.slug}`} className="group flex gap-4 py-5">
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="story-serif text-[22px] leading-tight text-ink group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">{s.title}</span>
              <span className="story-serif line-clamp-2 text-[16px] text-mute">{s.hook}</span>
              <span className="font-sans text-[13px] text-mute">{readLabel(s.readingMinutes)}</span>
            </span>
            {s.coverId && (
              <span className="w-[96px] shrink-0 overflow-hidden rounded-md bg-soft">
                <Picture base="/api/stories/media/" id={s.coverId} alt="" sizes="96px" className="aspect-square object-cover" />
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function SavedPage() {
  return (
    <StoriesShell>
      <div className="mx-auto flex w-full max-w-[728px] flex-col gap-6 px-6 pt-10 pb-20 sm:pt-14">
        <h1 className="story-serif text-[40px] leading-none font-medium tracking-[-0.02em] text-ink italic">Saved</h1>
        <Suspense fallback={<div className="h-40" aria-busy="true" />}>
          <Saved />
        </Suspense>
      </div>
    </StoriesShell>
  );
}
