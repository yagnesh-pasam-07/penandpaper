import Link from "next/link";
import type { ReactNode } from "react";
import { CATEGORY_LABEL, readLabel, storyDate, type Category } from "./logic";
import { parse, type Block, type Inline } from "./markdown";
import { Listen } from "./listen";
import { ReadingSignal } from "./reading-signal";
import { ShareStory } from "./share";

/** Where a story's files come from: the public route, or the writer's (drafts too). */
export type MediaBase = "/api/stories/media/" | "/studio/stories/media/";

export type Sizes = Record<string, { w: number; h: number }>;

/** A picture at the right width for the screen: a phone on 4G fetches the 480 or 960 one. */
export function Picture({ base, id, alt, sizes, size, eager = false, className = "" }: { base: MediaBase; id: string; alt: string; sizes: string; size?: { w: number; h: number }; eager?: boolean; className?: string }) {
  const url = `${base}${id}`;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- our own route already resizes (?w=) and caches for a year
    <img
      src={`${url}?w=960`}
      srcSet={`${url}?w=480 480w, ${url}?w=960 960w, ${url}?w=1600 1600w`}
      sizes={sizes}
      alt={alt}
      width={size?.w}
      height={size?.h}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : "auto"}
      decoding="async"
      className={`h-auto w-full bg-soft ${className}`}
    />
  );
}

function Inlines({ c }: { c: Inline[] }): ReactNode {
  return c.map((n, i) => {
    if (n.t === "text") return n.v;
    if (n.t === "br") return <br key={i} />;
    if (n.t === "em") return <em key={i}>{<Inlines c={n.c} />}</em>;
    if (n.t === "strong") return <strong key={i} className="font-semibold">{<Inlines c={n.c} />}</strong>;
    const external = /^https?:/.test(n.href);
    return (
      <a key={i} href={n.href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="underline decoration-1 underline-offset-[3px] hover:decoration-2">
        <Inlines c={n.c} />
      </a>
    );
  });
}

/** One block of a story, typeset for reading. */
function BlockView({ b, base, sizes, first }: { b: Block; base: MediaBase; sizes: Sizes; first: boolean }) {
  switch (b.t) {
    case "p":
      return (
        <p className={first ? "story-dropcap" : undefined}>
          <Inlines c={b.c} />
        </p>
      );
    case "h":
      return (
        <h2 className="pt-6 font-sans text-[22px] leading-snug font-semibold tracking-[-0.01em] text-ink sm:text-[24px]">
          <Inlines c={b.c} />
        </h2>
      );
    case "quote":
      return (
        <blockquote className="my-2 border-l-[3px] border-red pl-5 text-[23px] leading-[1.5] text-ink italic sm:pl-6 sm:text-[26px]">
          <Inlines c={b.c} />
        </blockquote>
      );
    case "hr":
      return (
        <div role="separator" aria-hidden="true" className="flex justify-center gap-4 py-4 text-[20px] tracking-[0.6em] text-mute">
          · · ·
        </div>
      );
    case "img":
      return (
        <figure className="my-2 flex flex-col gap-3">
          <Picture base={base} id={b.id} alt={b.caption || "A picture from the story"} sizes="(max-width: 728px) 100vw, 680px" size={sizes[b.id]} className="rounded-md" />
          {(b.caption || b.credit) && (
            <figcaption className="px-1 text-center font-sans text-[14px] leading-relaxed text-mute">
              {b.caption}
              {b.credit && <span className="block text-[12px] tracking-[0.04em] uppercase">Art: {b.credit}</span>}
            </figcaption>
          )}
        </figure>
      );
  }
}

export type ReaderStory = {
  title: string;
  subtitle: string;
  body: string;
  category: Category;
  readingMinutes: number;
  publishAt: string | null;
  author: string;
  coverId: string | null;
  coverCaption: string;
  audioId: string | null;
  audioDurationSec: number | null;
  originalUrl: string | null;
  language: string;
  slug: string;
  hook: string;
  shareText: string;
};

/**
 * The reading page: one column about 65 characters wide, a 20px serif, warm
 * paper or ink, nothing on the sides. Shared by the public page and the
 * writer's preview, so what you preview is exactly what is published.
 */
export function StoryReader({ story, base, sizes, url, more, count = false }: { story: ReaderStory; base: MediaBase; sizes: Sizes; url: string; more?: ReactNode; count?: boolean }) {
  const info = { slug: story.slug, url, title: story.title, hook: story.hook, line: story.shareText };
  const blocks = parse(story.body);
  const firstP = blocks.findIndex((b) => b.t === "p");
  const audio = story.audioId ? `${base}${story.audioId}` : null;
  const artwork = story.coverId ? `${base}${story.coverId}?w=480` : null;
  return (
    <article lang={story.language} className="story-serif flex flex-col">
      <header className="mx-auto flex w-full max-w-[728px] flex-col gap-5 px-6 pt-10 sm:pt-14">
        <p className="font-sans text-[13px] font-semibold tracking-[0.08em] text-red-text uppercase">
          <Link href="/stories" className="hover:underline">
            {CATEGORY_LABEL[story.category]}
          </Link>
        </p>
        <h1 className="text-[38px] leading-[1.08] font-medium tracking-[-0.02em] text-balance text-ink sm:text-[52px]">{story.title || "Untitled"}</h1>
        {story.subtitle && <p className="text-[21px] leading-[1.45] text-pretty text-mute sm:text-[23px]">{story.subtitle}</p>}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-3 border-y border-line py-4 font-sans text-[14px] text-mute">
          <span className="flex items-center gap-2.5">
            <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-full bg-ink text-[15px] font-semibold text-bg">
              {story.author.trim().charAt(0).toUpperCase() || "P"}
            </span>
            <span className="flex flex-col leading-tight">
              <span className="font-medium text-ink">{story.author}</span>
              <span>
                {readLabel(story.readingMinutes)}
                {story.publishAt ? ` · ${storyDate(story.publishAt)}` : ""}
              </span>
            </span>
          </span>
          <span className="ml-auto flex items-center gap-2">
            {audio && <Listen src={audio} title={story.title} author={story.author} artwork={artwork} duration={story.audioDurationSec} slug={count ? story.slug : undefined} />}
            <ShareStory info={info} compact />
          </span>
        </div>
      </header>

      {story.coverId && (
        <figure className="mx-auto mt-8 flex w-full max-w-[728px] flex-col gap-3 sm:mt-10 sm:px-6">
          <Picture base={base} id={story.coverId} alt={story.coverCaption || story.title} sizes="(max-width: 728px) 100vw, 680px" size={sizes[story.coverId]} eager className="sm:rounded-md" />
          {story.coverCaption && <figcaption className="px-5 text-center font-sans text-[14px] leading-relaxed text-mute">{story.coverCaption}</figcaption>}
        </figure>
      )}

      <div className="story-body mx-auto flex w-full max-w-[728px] flex-col gap-8 px-6 pt-10 pb-6 text-[19px] leading-[1.6] tracking-[-0.003em] text-ink/90 sm:text-[20px]">
        {blocks.map((b, i) => (
          <BlockView key={i} b={b} base={base} sizes={sizes} first={i === firstP} />
        ))}
      </div>

      <footer className="mx-auto flex w-full max-w-[728px] flex-col gap-6 px-6 pt-4 pb-16 font-sans">
        {count && <ReadingSignal slug={story.slug} />}
        <p id="story-end" aria-hidden="true" className="text-center text-[22px] text-red-text">
          ✒
        </p>
        {story.originalUrl && (
          <p className="text-center text-[14px] text-mute">
            First published on{" "}
            <a href={story.originalUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ink">
              {new URL(story.originalUrl).hostname.replace(/^www\./, "")}
            </a>
            .
          </p>
        )}
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-sheet px-5 py-6 text-center">
          <p className="story-serif text-[20px] text-ink">If it stayed with you, send it to someone.</p>
          <ShareStory info={info} />
        </div>
        {more}
      </footer>
    </article>
  );
}
