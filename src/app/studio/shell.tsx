import Link from "next/link";
import type { ReactNode } from "react";
import { PenIcon } from "@/components/icons";
import { leave } from "./actions";

/**
 * Studio's frame, like YouTube Studio: a fixed rail on the left (Overview,
 * Stories, then each live story, so any story's numbers are one click away)
 * and the page using the full width beside it. On a phone the rail becomes a
 * row of tabs under the top bar.
 */

export const studioVars =
  "[--studio-blue:#2a78d6] [--studio-up:#0b7a0b] [--studio-down:#c43333] [[data-theme=dark]_&]:[--studio-blue:#3987e5] [[data-theme=dark]_&]:[--studio-up:#3fbf3f] [[data-theme=dark]_&]:[--studio-down:#e66767]";
export const studioNumbers =
  "[font-family:var(--font-inter),var(--font-instrument),system-ui,sans-serif] [font-feature-settings:'tnum'_1,'cv11'_1]";

export type Section = "overview" | "stories" | { story: string };
export type RailStory = { id: string; title: string };

function OverviewIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M3 16.5h14M5.5 13.5v-4M10 13.5V5M14.5 13.5V8" />
    </svg>
  );
}

function StoriesIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 3.5h9l3 3v10H4z" />
      <path d="M7 9h6M7 12h6M7 6h3" />
    </svg>
  );
}

const isStory = (s: Section): s is { story: string } => typeof s === "object";

export function StudioShell({
  section,
  title,
  subtitle,
  actions,
  stories = [],
  children,
}: {
  section: Section;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  stories?: RailStory[];
  children: ReactNode;
}) {
  const item = (on: boolean) =>
    `flex h-10 items-center gap-3 rounded-lg px-3 text-[14px] transition-colors ${on ? "bg-soft font-semibold text-ink" : "text-mute hover:bg-soft/70 hover:text-ink"}`;
  const tab = (on: boolean) =>
    `shrink-0 rounded-full px-3.5 py-1.5 text-[13px] ${on ? "bg-ink font-semibold text-bg" : "text-mute"}`;
  return (
    <div
      className={`flex min-h-dvh flex-col bg-bg ${studioVars} ${studioNumbers}`}
    >
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-bg/90 px-4 backdrop-blur-md lg:px-6">
        <Link
          href="/drop"
          aria-label="Back to my paper"
          className="flex items-center gap-2"
        >
          <span className="text-red-text">
            <PenIcon size={20} />
          </span>
          <span className="text-[17px] font-semibold tracking-[-0.02em]">
            Studio
          </span>
        </Link>
        <span className="rounded-full border border-line px-2 py-0.5 text-[11px] font-medium text-mute">
          Pen &amp; Paper
        </span>
        <span className="ml-auto flex items-center gap-1">
          <Link
            href="/stories"
            target="_blank"
            className="h-8 rounded-lg px-3 text-[13px] leading-8 text-mute hover:bg-soft hover:text-ink max-sm:hidden"
          >
            View site ↗
          </Link>
          <form action={leave}>
            <button
              type="submit"
              className="h-8 rounded-lg px-3 text-[13px] font-medium text-mute hover:bg-soft hover:text-ink"
            >
              Lock
            </button>
          </form>
        </span>
      </header>

      {/* Phone: the rail as tabs. */}
      <nav
        aria-label="Studio"
        className="flex gap-1 overflow-x-auto border-b border-line px-4 py-2 lg:hidden"
      >
        <Link href="/studio/stories" className={tab(section === "stories")}>
          Stories
        </Link>
        <Link href="/studio" className={tab(section === "overview")}>
          App
        </Link>
        {stories.map((s) => (
          <Link
            key={s.id}
            href={`/studio/stories/${s.id}/reach`}
            className={`${tab(isStory(section) && section.story === s.id)} max-w-[180px] truncate`}
          >
            {s.title || "Untitled"}
          </Link>
        ))}
      </nav>

      <div className="flex flex-1">
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-60 shrink-0 flex-col gap-1 overflow-y-auto border-r border-line px-3 py-5 lg:flex">
          {/* Stories first: what a writer opens Studio for. The app's own numbers sit beside them. */}
          <Link href="/studio/stories" className={item(section === "stories")}>
            <StoriesIcon />
            Stories
          </Link>
          <Link href="/studio" className={item(section === "overview")}>
            <OverviewIcon />
            App
          </Link>
          {stories.length > 0 && (
            <>
              <p className="px-3 pt-5 pb-1 text-[11px] font-semibold tracking-[0.08em] text-mute uppercase">
                Live stories
              </p>
              {stories.map((s) => {
                const on = isStory(section) && section.story === s.id;
                return (
                  <Link
                    key={s.id}
                    href={`/studio/stories/${s.id}/reach`}
                    className={`${item(on)} h-auto py-2 leading-snug`}
                  >
                    <span
                      aria-hidden="true"
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ background: "var(--studio-up)" }}
                    />
                    <span className="line-clamp-2">
                      {s.title || "Untitled"}
                    </span>
                  </Link>
                );
              })}
            </>
          )}
        </aside>

        <main className="flex min-w-0 flex-1 flex-col gap-6 px-4 pt-6 pb-24 sm:px-6 lg:px-10 lg:pt-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="text-[26px] font-semibold tracking-[-0.02em] sm:text-[28px]">
                {title}
              </h1>
              {subtitle && <p className="text-[14px] text-mute">{subtitle}</p>}
            </div>
            {actions && (
              <div className="flex flex-wrap items-center gap-2">{actions}</div>
            )}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
