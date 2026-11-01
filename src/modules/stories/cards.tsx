import Link from "next/link";
import { CATEGORY_LABEL, readLabel, storyDate } from "./logic";
import { Picture } from "./reader";
import type { StoryCard } from "./server";

/** The first story on /stories: big cover, big title. */
export function LeadCard({ s }: { s: StoryCard }) {
  return (
    <Link href={`/stories/${s.slug}`} className="group grid gap-6 sm:grid-cols-[1.25fr_1fr] sm:items-center sm:gap-10">
      <div className="overflow-hidden rounded-lg bg-soft">
        {s.coverId ? (
          <Picture base="/api/stories/media/" id={s.coverId} alt="" sizes="(max-width: 640px) 100vw, 620px" eager className="aspect-[4/3] object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
        ) : (
          <div aria-hidden="true" className="flex aspect-[4/3] items-center justify-center text-[64px] text-red-text">
            ✒
          </div>
        )}
      </div>
      <div className="flex flex-col gap-3">
        <Meta s={s} />
        <h2 className="story-serif text-[32px] leading-[1.1] font-medium tracking-[-0.015em] text-balance text-ink group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4 sm:text-[42px]">{s.title}</h2>
        <p className="story-serif text-[19px] leading-[1.5] text-pretty text-mute">{s.hook}</p>
        <Foot s={s} />
      </div>
    </Link>
  );
}

/** Every other story: a row with a small cover on the right, the way a good magazine lists its pieces. */
export function RowCard({ s }: { s: StoryCard }) {
  return (
    <Link href={`/stories/${s.slug}`} className="group flex gap-4 py-6 sm:gap-8">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Meta s={s} />
        <h3 className="story-serif text-[22px] leading-[1.2] font-medium text-balance text-ink group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4 sm:text-[26px]">{s.title}</h3>
        <p className="story-serif line-clamp-2 text-[17px] leading-[1.5] text-mute max-sm:hidden">{s.hook}</p>
        <Foot s={s} />
      </div>
      {s.coverId && (
        <div className="w-[104px] shrink-0 overflow-hidden rounded-md bg-soft sm:w-[180px]">
          <Picture base="/api/stories/media/" id={s.coverId} alt="" sizes="180px" className="aspect-square object-cover sm:aspect-[4/3]" />
        </div>
      )}
    </Link>
  );
}

function Meta({ s }: { s: StoryCard }) {
  return (
    <p className="flex items-center gap-2 text-[12px] font-semibold tracking-[0.08em] uppercase">
      <span className="text-red-text">{CATEGORY_LABEL[s.category]}</span>
      {s.series && <span className="truncate text-mute normal-case tracking-normal">· {s.series}</span>}
      {s.language === "te" && <span className="rounded bg-soft px-1.5 py-0.5 text-[11px] tracking-normal text-ink normal-case">తెలుగు</span>}
    </p>
  );
}

function Foot({ s }: { s: StoryCard }) {
  return (
    <p className="flex items-center gap-2 text-[13px] text-mute">
      <span>{storyDate(s.publishAt)}</span>
      <span aria-hidden="true">·</span>
      <span>{readLabel(s.readingMinutes)}</span>
      {s.hasAudio && (
        <>
          <span aria-hidden="true">·</span>
          <span className="font-medium text-ink">Listen</span>
        </>
      )}
    </p>
  );
}
