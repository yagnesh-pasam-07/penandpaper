import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { StoriesShell } from "@/modules/stories/chrome";
import { storyFonts } from "@/modules/stories/fonts";
import { mediaIds } from "@/modules/stories/markdown";
import { StoryReader } from "@/modules/stories/reader";
import { mediaSizes, storyForWriter } from "@/modules/stories/server";
import { siteUrl } from "@/modules/stories/site";
import { writerOrPage } from "@/modules/stories/studio-gate";

export const metadata: Metadata = { title: "Preview · Studio", robots: { index: false, follow: false } };

/** Exactly the reading page, for a draft: the same component, the writer's own file route. */
async function Preview({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const writer = await writerOrPage(`/studio/stories/${id}/preview`);
  if (!writer || typeof writer !== "object" || !("id" in writer)) return writer;
  if (!z.uuid().safeParse(id).success) notFound();
  const s = await storyForWriter(id);
  if (!s) notFound();
  const sizes = await mediaSizes([s.coverId, ...mediaIds(s.body)].filter((x): x is string => !!x));
  return (
    <>
      <p className="sticky top-14 z-20 bg-amber-soft px-4 py-2 text-center font-sans text-[13px] text-amber">
        Preview · {s.state === "published" ? "published" : s.state === "scheduled" ? "scheduled" : "draft, only you can see it"} ·{" "}
        <Link href={`/studio/stories/${s.id}`} className="font-semibold underline">
          Back to writing
        </Link>
      </p>
      <StoryReader story={{ ...s, publishAt: s.publishAtRaw?.toISOString() ?? new Date().toISOString() }} base="/studio/stories/media/" sizes={sizes} url={`${siteUrl()}/stories/${s.slug}`} />
    </>
  );
}

export default function PreviewPage(props: PageProps<"/studio/stories/[id]/preview">) {
  return (
    <div className={storyFonts}>
      <StoriesShell>
        <Suspense fallback={<div className="min-h-dvh" aria-busy="true" />}>
          <Preview params={props.params} />
        </Suspense>
      </StoriesShell>
    </div>
  );
}
