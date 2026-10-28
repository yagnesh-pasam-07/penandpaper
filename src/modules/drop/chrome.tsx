"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSyncExternalStore, type ReactNode } from "react";
import { PenIcon } from "@/components/icons";
import { AccountMenu, Logo, ThemeToggle } from "@/components/ui";
import { useStore } from "@/lib/store";
import { browserTz, clock } from "@/lib/time";
import type { Thought } from "./logic";

export type Me = { name: string; email: string };

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

/** One slim row: logo, the day (when there is one), then History, theme and the account. */
export function DropHeader({ me, title, right }: { me: Me; title?: ReactNode; right?: ReactNode }) {
  const router = useRouter();
  const signOut = useStore((s) => s.signOut);
  return (
    <header className="mx-auto flex w-full max-w-[1120px] items-center gap-3 px-4 pt-4 pb-1 sm:px-8">
      <Link href="/drop" aria-label="Today's paper" className="shrink-0">
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
      <span className="ml-auto flex shrink-0 items-center gap-1.5">
        {right}
        <ThemeToggle persist />
        <AccountMenu
          name={me.name}
          email={me.email}
          onSignOut={async () => {
            await signOut();
            router.push("/");
          }}
        />
      </span>
    </header>
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

/** A red rubber stamp, slightly askew: "DESK CLEARED" and the date. */
export function DeskStamp({ date, small = false, animate = false }: { date: string; small?: boolean; animate?: boolean }) {
  return (
    <span
      role="img"
      aria-label={`Desk cleared, ${date}`}
      className={`inline-flex flex-col items-center rounded-[10px] border-red-text font-bold tracking-[0.14em] text-red-text uppercase ${animate ? "stamp-in" : ""} ${
        small ? "-rotate-6 border-2 px-1.5 py-0.5 text-[9px] leading-tight" : "-rotate-[8deg] border-[3px] px-5 py-2.5 text-[28px] leading-none"
      }`}
    >
      <span>Desk cleared</span>
      <span className={`font-mono font-medium tracking-normal normal-case ${small ? "text-[8px]" : "mt-1.5 text-[13px]"}`}>{date}</span>
    </span>
  );
}
