import Link from "next/link";
import { CATEGORY_LABEL, readLabel } from "@/modules/stories/logic";
import { Picture } from "@/modules/stories/reader";
import { lovedThisMonth, publishedStories } from "@/modules/stories/server";

/**
 * "Latest reads" on the homepage: the newest story large, the next ones in a
 * row beside or under it, each a real person's story. Nothing at all until
 * the first story is out. Cached with the stories.
 */
export async function ThisWeeksStory() {
  // The feature: the most-clapped story of the last 30 days (the newest when nothing has claps yet); then the newest others.
  const [loved, newest] = await Promise.all([lovedThisMonth(), publishedStories(4)]);
  const lead = loved ?? newest[0];
  if (!lead) return null;
  const rest = newest.filter((s) => s.id !== lead.id).slice(0, 3);
  const href = `/stories/${lead.slug}`;
  return (
    <section aria-labelledby="reads-title" className="mx-auto flex w-full max-w-[1040px] flex-col gap-6 px-4 py-12 sm:px-8 sm:py-20">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h2 id="reads-title" className="story-serif text-[34px] leading-none font-medium tracking-[-0.02em] italic sm:text-[44px]">
            Latest reads
          </h2>
          <p className="story-serif text-[17px] text-mute sm:text-[19px]">Real people, history and art. A few minutes each.</p>
        </div>
        <Link href="/stories" className="shrink-0 text-[15px] font-medium text-mute underline-offset-4 hover:text-ink hover:underline">
          All stories →
        </Link>
      </div>

      <div className="grid overflow-hidden rounded-[22px] border border-line bg-sheet sm:grid-cols-[1.1fr_1fr]">
        {lead.coverId ? (
          <Link href={href} tabIndex={-1} aria-hidden="true" className="block bg-soft">
            <Picture base="/api/stories/media/" id={lead.coverId} alt="" sizes="(max-width: 640px) 100vw, 560px" className="aspect-[4/3] h-full object-cover sm:aspect-auto" />
          </Link>
        ) : (
          <div aria-hidden="true" className="flex aspect-[4/3] items-center justify-center bg-soft text-[72px] text-red-text sm:aspect-auto">
            ✒
          </div>
        )}
        <div className="flex flex-col gap-4 p-6 sm:p-10">
          <p className="text-[12px] font-semibold tracking-[0.1em] text-red-text uppercase">
            {loved ? "Most loved this month" : "New"} · {CATEGORY_LABEL[lead.category]}
          </p>
          <h3 className="story-serif text-[30px] leading-[1.1] font-medium tracking-[-0.015em] text-balance sm:text-[38px]">
            <Link href={href} className="hover:underline hover:decoration-1 hover:underline-offset-4">
              {lead.title}
            </Link>
          </h3>
          <p className="story-serif text-[18px] leading-[1.5] text-pretty text-mute sm:text-[19px]">{lead.hook}</p>
          <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
            <Link href={href} className="flex h-11 items-center rounded-full bg-ink px-5 text-[15px] font-semibold text-bg hover:opacity-90">
              Read · {readLabel(lead.readingMinutes)}
            </Link>
            {lead.hasAudio && (
              <Link href={`${href}#listen`} className="flex h-11 items-center gap-2 rounded-full border border-line px-5 text-[15px] font-medium hover:bg-soft">
                ▶ Listen
              </Link>
            )}
          </div>
        </div>
      </div>

      {rest.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-3">
          {rest.map((s) => (
            <li key={s.id}>
              <Link href={`/stories/${s.slug}`} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-sheet">
                {s.coverId ? (
                  <Picture base="/api/stories/media/" id={s.coverId} alt="" sizes="(max-width: 640px) 100vw, 340px" className="aspect-[16/10] object-cover" />
                ) : (
                  <div aria-hidden="true" className="flex aspect-[16/10] items-center justify-center bg-soft text-[40px] text-red-text">
                    ✒
                  </div>
                )}
                <span className="flex flex-1 flex-col gap-2 p-5">
                  <span className="text-[11px] font-semibold tracking-[0.1em] text-red-text uppercase">{CATEGORY_LABEL[s.category]}</span>
                  <span className="story-serif text-[21px] leading-[1.2] font-medium text-balance group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">{s.title}</span>
                  <span className="mt-auto pt-2 text-[13px] text-mute">{readLabel(s.readingMinutes)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
