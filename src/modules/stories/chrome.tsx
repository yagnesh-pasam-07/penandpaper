import Link from "next/link";
import type { ReactNode } from "react";
import { Logo, ThemeToggle } from "@/components/ui";

/** The stories' own header: the brand, "Stories", and the theme. No app chrome, no sign-up nag. */
export function StoriesHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/90 backdrop-blur-md">
      <nav aria-label="Stories" className="mx-auto flex h-14 w-full max-w-[1120px] items-center gap-3 px-4 sm:px-8">
        <Link href="/" aria-label="Pen & Paper home" className="rounded-sm">
          <Logo size="sm" />
        </Link>
        <span aria-hidden="true" className="h-5 w-px bg-line" />
        <Link href="/stories" className="story-serif text-[19px] text-ink italic hover:text-red-text">
          Stories
        </Link>
        <span className="ml-auto">
          <ThemeToggle />
        </span>
      </nav>
    </header>
  );
}

export function StoriesFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-3 px-4 py-8 text-[13px] text-mute sm:flex-row sm:items-center sm:px-8">
        <span className="story-serif text-[16px] text-ink italic">Real stories, read slowly.</span>
        <span className="flex gap-5 sm:ml-auto">
          <Link href="/stories/rss.xml" className="hover:text-ink">
            RSS
          </Link>
          <Link href="/" className="hover:text-ink">
            Pen &amp; Paper
          </Link>
          <Link href="/privacy" className="hover:text-ink">
            Privacy
          </Link>
        </span>
      </div>
    </footer>
  );
}

export function StoriesShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <StoriesHeader />
      <main className="flex-1">{children}</main>
      <StoriesFooter />
    </div>
  );
}
