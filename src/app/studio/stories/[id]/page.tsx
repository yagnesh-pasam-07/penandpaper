import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { StoryEditor } from "@/modules/stories/editor";
import { storyFonts } from "@/modules/stories/fonts";
import { storyForWriter } from "@/modules/stories/server";
import { writerOrPage } from "@/modules/stories/studio-gate";

export const metadata: Metadata = { title: "Writing · Studio", robots: { index: false, follow: false } };

async function Editor({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const writer = await writerOrPage(`/studio/stories/${id}`);
  if (!writer || typeof writer !== "object" || !("id" in writer)) return writer;
  if (!z.uuid().safeParse(id).success) notFound();
  const s = await storyForWriter(id);
  if (!s) notFound();
  return (
    <StoryEditor
      initial={{
        id: s.id,
        slug: s.slug,
        title: s.title,
        subtitle: s.subtitle,
        hook: s.hook === s.body.slice(0, s.hook.length) ? "" : s.hook,
        body: s.body,
        category: s.category,
        coverId: s.coverId,
        coverCaption: s.coverCaption,
        audioId: s.audioId,
        audioDurationSec: s.audioDurationSec,
        originalUrl: s.originalUrl,
        readingMinutes: s.readingMinutes,
        state: s.state,
        publishAt: s.publishAtRaw?.toISOString() ?? null,
      }}
    />
  );
}

export default function EditStoryPage(props: PageProps<"/studio/stories/[id]">) {
  return (
    <div className={storyFonts}>
      <Suspense fallback={<div className="min-h-dvh bg-bg" aria-busy="true" />}>
        <Editor params={props.params} />
      </Suspense>
    </div>
  );
}
