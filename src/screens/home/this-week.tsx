import Link from "next/link";
import { CATEGORY_LABEL, readLabel } from "@/modules/stories/logic";
import { Picture } from "@/modules/stories/reader";
import { latestStory } from "@/modules/stories/server";

/**
 * "This week's story": the newest published story, on the homepage: cover,
 * title, its one line, Read and (when there's a recording) Listen. Nothing at
 * all until the first story is out. Cached with the stories.
 */
export async function ThisWeeksStory() {
  const s = await latestStory();
  if (!s) return null;
  const href = `/stories/${s.slug}`;
  return (
    <section aria-labelledby="week-title" className="mx-auto w-full max-w-[1040px] px-4 py-12 sm:px-8 sm:py-20">
      <div className="grid overflow-hidden rounded-[22px] border border-line bg-sheet sm:grid-cols-[1.1fr_1fr]">
        {s.coverId ? (
          <Link href={href} tabIndex={-1} aria-hidden="true" className="block bg-soft">
            <Picture base="/api/stories/media/" id={s.coverId} alt="" sizes="(max-width: 640px) 100vw, 560px" className="aspect-[4/3] h-full object-cover sm:aspect-auto" />
          </Link>
        ) : (
          <div aria-hidden="true" className="flex aspect-[4/3] items-center justify-center bg-soft text-[72px] text-red-text sm:aspect-auto">
            ✒
          </div>
        )}
        <div className="flex flex-col gap-4 p-6 sm:p-10">
          <p id="week-title" className="text-[12px] font-semibold tracking-[0.1em] text-red-text uppercase">
            This week&apos;s story · {CATEGORY_LABEL[s.category]}
          </p>
          <h2 className="story-serif text-[30px] leading-[1.1] font-medium tracking-[-0.015em] text-balance sm:text-[38px]">
            <Link href={href} className="hover:underline hover:decoration-1 hover:underline-offset-4">
              {s.title}
            </Link>
          </h2>
          <p className="story-serif text-[18px] leading-[1.5] text-pretty text-mute sm:text-[19px]">{s.hook}</p>
          <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
            <Link href={href} className="flex h-11 items-center rounded-full bg-ink px-5 text-[15px] font-semibold text-bg hover:opacity-90">
              Read · {readLabel(s.readingMinutes)}
            </Link>
            {s.hasAudio && (
              <Link href={`${href}#listen`} className="flex h-11 items-center gap-2 rounded-full border border-line px-5 text-[15px] font-medium hover:bg-soft">
                ▶ Listen
              </Link>
            )}
            <Link href="/stories" className="text-[14px] text-mute underline-offset-2 hover:text-ink hover:underline">
              All stories
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
