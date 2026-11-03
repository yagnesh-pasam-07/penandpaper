import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { StoriesShell } from "@/modules/stories/chrome";
import { mergePosts, rating, SHELVES, short, splitCaption, UNNOTICED, unnoticedPosts, type Post } from "@/modules/stories/unnoticed";
import { InstagramEmbeds } from "./embeds";

export const metadata: Metadata = {
  title: "Unnoticed · Pen & Paper Stories",
  description: "Small moments nobody noticed: people, nature and the things we all do, told with a smile. Short pieces in Telugu, by Pen & Paper.",
  alternates: { canonical: "/stories/unnoticed" },
  openGraph: { title: "Unnoticed, by Pen & Paper", description: "Small moments nobody noticed. Short, relatable, in Telugu.", type: "website", url: "/stories/unnoticed" },
};

/** /stories/unnoticed: the short pieces from Instagram, as shelves (like Netflix), ranked by how loved they are (like IMDB). */
export default function UnnoticedPage() {
  return (
    <Suspense fallback={<StoriesShell>{null}</StoriesShell>}>
      <Shelves />
    </Suspense>
  );
}

/** A small tilt per post, the same every time: taped on by hand, not laid out by a machine. */
const tilt = (code: string) => (([...code].reduce((n, c) => n + c.charCodeAt(0), 0) % 5) - 2) * 0.6;

async function Shelves() {
  const fromApi = await unnoticedPosts();
  const posts = mergePosts(fromApi);
  const rated = posts.filter((p) => p.likes !== null);
  // "Most loved": the ten with the best rating; only when Instagram gave numbers.
  const top = [...rated].sort((a, b) => (rating(b, posts) ?? 0) - (rating(a, posts) ?? 0)).slice(0, 10);
  const newest = posts.filter((p) => p.image).slice(0, 12);
  const shelves = SHELVES.map((sh) => ({ ...sh, posts: posts.filter((p) => p.shelves.includes(sh.key) && p.image) })).filter((sh) => sh.posts.length > 0);
  // Pinned posts Instagram's API didn't fill in: shown through Instagram's own embed.
  const embedded = posts.filter((p) => !p.image);

  return (
    <StoriesShell>
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-12 px-5 pt-10 pb-20 sm:px-8 sm:pt-14">
        <header className="flex flex-col gap-4 border-b border-line pb-8">
          <span className="font-hand text-[22px] text-red-text">pen &amp; paper presents</span>
          <h1 className="story-serif text-[52px] leading-[0.95] font-medium tracking-[-0.02em] text-ink italic sm:text-[76px]">Unnoticed</h1>
          <p className="story-serif max-w-[620px] text-[19px] leading-[1.5] text-mute sm:text-[21px]">
            The small moments nobody noticed. People, nature, and the things we all do, told with a smile, in Telugu. One will be about you; the next, about someone you know.
          </p>
          <p className="story-serif max-w-[620px] text-[19px] leading-[1.5] text-ink sm:text-[21px]" lang="te">
            చూసి నవ్వుకుని, &ldquo;అరె, ఇది నేనే కదా&rdquo; అనుకునే చిన్న క్షణాలు.
          </p>
          <span className="flex flex-wrap items-center gap-3 font-sans text-[14px]">
            <a href={UNNOTICED.url} target="_blank" rel="noopener" className="rounded-full bg-ink px-4 py-2 font-semibold text-bg">
              Follow @{UNNOTICED.handle} ↗
            </a>
            <Link href="/stories" className="text-mute hover:text-ink">
              Long stories →
            </Link>
          </span>
        </header>

        {top.length >= 3 && (
          <Shelf title="Most loved" sub="ranked by your hearts and comments">
            {top.map((p, i) => (
              <li key={p.id} className="flex shrink-0 snap-start items-end">
                <span aria-hidden="true" className="font-hand -mr-3 text-[120px] leading-[0.8] font-bold text-red-text/85 sm:text-[150px]">
                  {i + 1}
                </span>
                <Card post={p} all={posts} rank={i + 1} />
              </li>
            ))}
          </Shelf>
        )}

        {newest.length > 0 && (
          <Shelf title="Fresh off the page" sub="the newest">
            {newest.map((p) => (
              <li key={p.id} className="shrink-0 snap-start">
                <Card post={p} all={posts} />
              </li>
            ))}
          </Shelf>
        )}

        {shelves.map((sh) => (
          <Shelf key={sh.key} title={sh.title} sub={sh.sub}>
            {sh.posts.map((p) => (
              <li key={p.id} className="shrink-0 snap-start">
                <Card post={p} all={posts} />
              </li>
            ))}
          </Shelf>
        ))}

        {embedded.length > 0 && (
          <section aria-labelledby="pinned" className="flex flex-col gap-5">
            <ShelfTitle id="pinned" title={fromApi ? "Also on the page" : "On the page"} sub="straight from Instagram" />
            <InstagramEmbeds codes={embedded.map((p) => p.code)} />
          </section>
        )}

        {posts.length === 0 && (
          <p className="story-serif text-center text-[19px] text-mute">
            The first ones are on their way. Meanwhile, they&apos;re all on{" "}
            <a href={UNNOTICED.url} target="_blank" rel="noopener" className="text-ink underline underline-offset-4">
              Instagram
            </a>
            .
          </p>
        )}
      </div>
    </StoriesShell>
  );
}

function ShelfTitle({ id, title, sub }: { id: string; title: string; sub: string }) {
  return (
    <h2 id={id} className="flex flex-wrap items-baseline gap-x-3">
      <span className="font-hand text-[34px] leading-none font-bold text-ink">{title}</span>
      <span className="font-sans text-[13px] text-mute">{sub}</span>
    </h2>
  );
}

/** One row, scrolling sideways like a Netflix row (a swipe on a phone, a trackpad or Shift+wheel on a computer). */
function Shelf({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  const id = `shelf-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <ShelfTitle id={id} title={title} sub={sub} />
      <ul className="-mx-5 flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-px-5 px-5 pt-3 pb-6 sm:-mx-8 sm:scroll-px-8 sm:px-8 [scrollbar-width:thin]">{children}</ul>
    </section>
  );
}

/** A post taped onto the paper like a polaroid: the picture, its first line in handwriting, and its rating. */
function Card({ post, all, rank }: { post: Post; all: Post[]; rank?: number }) {
  const { title } = splitCaption(post.caption);
  const r = rating(post, all);
  return (
    <a
      href={post.link}
      target="_blank"
      rel="noopener"
      aria-label={`${title || "A post"}${r ? `, rated ${r} out of 10` : ""}${rank ? `, number ${rank}` : ""}. Opens on Instagram.`}
      style={{ transform: `rotate(${tilt(post.code)}deg)` }}
      className="group relative flex w-[200px] flex-col gap-2 bg-sheet p-2.5 pb-3 shadow-[0_14px_28px_-16px_var(--shadow)] ring-1 ring-line transition-transform duration-200 hover:z-10 hover:!rotate-0 hover:scale-[1.04] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-text sm:w-[220px]"
    >
      {/* A strip of tape holding it to the page. */}
      <span aria-hidden="true" className="absolute -top-2.5 left-1/2 h-5 w-16 -translate-x-1/2 rotate-[-3deg] bg-[color-mix(in_srgb,var(--sheet)_55%,#e9dcae)] opacity-90 shadow-sm" />
      <span className="relative block aspect-[4/5] overflow-hidden bg-soft">
        {/* eslint-disable-next-line @next/next/no-img-element -- Instagram's own signed CDN address; it changes, so it can't go through the image optimiser */}
        <img src={post.image!} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover grayscale-[15%] sepia-[8%] transition group-hover:grayscale-0 group-hover:sepia-0" />
        {post.kind === "video" && (
          <span aria-hidden="true" className="absolute top-2 right-2 rounded-full bg-black/55 px-2 py-0.5 font-sans text-[11px] font-semibold text-white">
            ▶ reel
          </span>
        )}
      </span>
      <span lang="te" className="font-hand line-clamp-2 min-h-[2.4em] text-[19px] leading-[1.2] text-ink">
        {title || "Unnoticed"}
      </span>
      <span className="flex items-center justify-between font-sans text-[12px] text-mute">
        {r !== null ? (
          <span className="flex items-baseline gap-1">
            <span className="font-hand text-[22px] leading-none font-bold text-red-text">{r.toFixed(1)}</span>
            <span>/10</span>
          </span>
        ) : (
          <span />
        )}
        {post.likes !== null && (
          <span className="tabular-nums">
            ♥ {short(post.likes)}
            {post.comments ? ` · 💬 ${short(post.comments)}` : ""}
          </span>
        )}
      </span>
    </a>
  );
}
