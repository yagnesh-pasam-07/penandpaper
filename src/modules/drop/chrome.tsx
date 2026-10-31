"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSyncExternalStore, type ReactNode } from "react";
import { PenIcon } from "@/components/icons";
import { AccountMenu, Logo, ThemeToggle } from "@/components/ui";
import { useStore } from "@/lib/store";
import { browserTz, clock } from "@/lib/time";
import type { Thought } from "./logic";

export type Me = { name: string; email: string; admin?: boolean };

/** The reading column for headings and the sheet. */
export const COLUMN = "mx-auto w-full max-w-[1056px]";

const noSubscribe = () => () => {};

/** The viewer's time zone; "UTC" while the server renders, so hydration matches. */
export function useViewerTz(): string {
  return useSyncExternalStore(noSubscribe, browserTz, () => "UTC");
}

/** False while the server renders and during hydration; true once the page is live. */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
}

export function meta(t: Pick<Thought, "createdAt">, tz: string): string {
  return clock(new Date(t.createdAt), tz);
}

/**
 * One slim row: logo, the paper (when there is one), then the right-hand tools, theme and the account.
 * `floating` (the canvas): no bar at all, just two small islands in the corners, so the paper runs to the top of the screen.
 */
export function DropHeader({ me, title, right, floating = false }: { me: Me; title?: ReactNode; right?: ReactNode; floating?: boolean }) {
  const router = useRouter();
  const signOut = useStore((s) => s.signOut);
  // Written out in full so Tailwind sees every class.
  const island = "sm:flex sm:items-center sm:rounded-2xl sm:border sm:border-line sm:bg-sheet/90 sm:shadow-[0_10px_30px_-18px_var(--shadow)] sm:backdrop-blur-md";
  return (
    // Its own layer above the canvas: notes panned or dragged up slide under it (frosted), never over the logo or the menu.
    <div className={floating ? "pointer-events-none fixed inset-x-0 top-0 z-40 sm:px-4 sm:pt-3" : "sticky top-0 z-40 w-full bg-bg/80 backdrop-blur-md"}>
      <header
        className={
          floating
            ? "flex w-full items-center gap-3 bg-bg/85 px-4 pt-4 pb-3 backdrop-blur-md sm:bg-transparent sm:p-0 sm:backdrop-blur-none [&>*]:pointer-events-auto"
            : "mx-auto flex w-full max-w-[1120px] items-center gap-3 px-4 pt-4 pb-3 sm:px-8"
        }
      >
      <span className={floating ? `contents sm:min-w-0 sm:gap-3 sm:py-1.5 sm:pr-2 sm:pl-3.5 ${island}` : "contents"}>
      <Link href="/drop" aria-label="Latest paper" className="shrink-0">
        <span className="max-sm:hidden">
          <Logo size="sm" />
        </span>
        <span className="text-red-text sm:hidden">
          <PenIcon size={22} />
        </span>
      </Link>
      {title && (
        <>
          <span aria-hidden="true" className="h-5 w-px shrink-0 bg-line max-sm:hidden" />
          <div className="flex min-w-0 items-baseline gap-2">{title}</div>
        </>
      )}
      </span>
      <span className={`ml-auto flex shrink-0 items-center gap-1.5 ${floating ? `sm:p-1 ${island}` : ""}`}>
        {right}
        {/* The extension and the Mac app; only on screens wide enough to use them. */}
        <Link href="/download" className="flex h-9 items-center rounded-lg px-2.5 text-[14px] font-medium text-mute hover:bg-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-text max-md:hidden">
          Download
        </Link>
        <ThemeToggle persist />
        <AccountMenu
          name={me.name}
          email={me.email}
          admin={me.admin}
          onSignOut={async () => {
            await signOut();
            router.push("/");
          }}
        />
      </span>
      </header>
    </div>
  );
}

/** JSON in and out of Drop's API; a lost session reloads to the log-in page. */
export async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" }, cache: "no-store" });
  if (res.status === 401) {
    // A full load on purpose: the session is gone, so nothing on screen should survive.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login?next=/drop";
    throw new Error("Signed out.");
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Couldn't reach your paper. Check your connection.");
  }
  return (res.status === 204 ? null : res.json()) as Promise<T>;
}
