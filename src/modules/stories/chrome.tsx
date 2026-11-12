import type { ReactNode } from "react";
import { SiteFooter, SiteHeader } from "@/components/site";
import { ReaderAccount } from "./reader-account";

/** Writing, a piece, about and credits wear the site's one frame; a reader's account sits at the end. */
export function StoriesShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <SiteHeader sticky end={<ReaderAccount />} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
