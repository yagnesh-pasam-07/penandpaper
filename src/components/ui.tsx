"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { BackIcon, MoonIcon, PenIcon, SunIcon } from "./icons";
import type { Tint } from "@/lib/types";
import { btn } from "./btn";

/* ---------- Buttons ---------- */

// Plain class strings, in their own module so server components can use them too.
export { btn };

/* ---------- Brand ---------- */

export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const icon = size === "lg" ? 24 : size === "md" ? 22 : 20;
  const text = size === "lg" ? "text-[28px]" : size === "md" ? "text-[26px]" : "text-2xl";
  return (
    <span className="flex items-center gap-2 text-red-text">
      <PenIcon size={icon} />
      <span className={`font-hand font-bold text-ink ${text}`}>pen &amp; paper</span>
    </span>
  );
}

/* ---------- Theme ---------- */

const THEME_EVENT = "pp-theme";

function readTheme(): "light" | "dark" {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function subscribeTheme(cb: () => void) {
  window.addEventListener(THEME_EVENT, cb);
  return () => window.removeEventListener(THEME_EVENT, cb);
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "light" as const);
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => {
        document.documentElement.setAttribute("data-theme", next);
        try {
          localStorage.setItem("pp-theme", next);
        } catch {}
        window.dispatchEvent(new Event(THEME_EVENT));
      }}
      aria-label={next === "dark" ? "Switch to Ink (dark) theme" : "Switch to Paper (light) theme"}
      className="flex size-10 items-center justify-center rounded-full text-mute hover:bg-soft hover:text-ink"
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

/* ---------- People ---------- */

const tintBg: Record<Tint, string> = { t1: "bg-t1", t2: "bg-t2", t3: "bg-t3", t4: "bg-t4", t5: "bg-t5" };

export function tintClass(tint: Tint): string {
  return tintBg[tint];
}

export function Avatar({
  name,
  tint,
  size = 30,
  className = "",
}: {
  name: string;
  tint?: Tint;
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${tint ? `${tintBg[tint]} text-ink` : "border border-line bg-soft text-ink"} ${className}`}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

/** The signed-in person's avatar; opens a small menu with their email and Sign out. */
export function AccountMenu({ name, email, tint, onSignOut }: { name: string; email: string; tint?: Tint; onSignOut: () => void }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false;
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);
  return (
    <details ref={ref} className="relative">
      <summary aria-label="Account" className="flex cursor-pointer list-none rounded-full [&::-webkit-details-marker]:hidden">
        <Avatar name={name} tint={tint} size={36} />
      </summary>
      <div className="absolute right-0 z-40 mt-2 flex w-60 flex-col gap-1 rounded-2xl border border-line bg-sheet p-2 shadow-[0_18px_40px_-20px_var(--shadow)]">
        <span className="flex flex-col px-3 py-2">
          <span className="text-sm font-semibold">{name}</span>
          <span className="truncate text-[13px] text-mute">{email}</span>
        </span>
        <Link href="/drop" className="rounded-xl px-3 py-2.5 text-sm hover:bg-soft">
          My paper
        </Link>
        <Link href="/drop/history" className="rounded-xl px-3 py-2.5 text-sm hover:bg-soft">
          Past papers
        </Link>
        <Link href="/projects" className="rounded-xl px-3 py-2.5 text-sm hover:bg-soft">
          Team projects
        </Link>
        <Link href="/me" className="rounded-xl px-3 py-2.5 text-sm hover:bg-soft">
          Team papers
        </Link>
        <button type="button" onClick={onSignOut} className="rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-text hover:bg-red-soft">
          Sign out
        </button>
      </div>
    </details>
  );
}

/* ---------- Layout ---------- */

export function BackButton({ href, label, size = 40 }: { href: string; label: string; size?: number }) {
  return (
    <Link
      href={href}
      aria-label={label}
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-xl border border-line bg-sheet text-ink hover:bg-soft"
    >
      <BackIcon />
    </Link>
  );
}

/** Top bar for the lead's screens. `left` is the logo or a back link. */
export function LeadHeader({ left, right, wide = false }: { left: ReactNode; right?: ReactNode; wide?: boolean }) {
  return (
    <header
      className={`mx-auto flex w-full flex-wrap items-center justify-between gap-4 px-4 pt-6 pb-2 sm:px-8 ${wide ? "max-w-[1240px]" : "max-w-[1120px]"}`}
    >
      {left}
      <span className="flex items-center gap-2">
        {right}
        <ThemeToggle />
      </span>
    </header>
  );
}

export function Breadcrumb({ href, label, title }: { href: string; label: string; title?: string }) {
  return (
    <span className="flex items-center gap-3.5">
      <BackButton href={href} label={`Back to ${label.toLowerCase()}`} />
      {title ? (
        <span className="flex flex-col">
          <span className="text-[13px] text-mute">{label}</span>
          <span className="font-hand text-4xl leading-none font-bold">{title}</span>
        </span>
      ) : (
        <span className="text-[15px] text-mute">{label}</span>
      )}
    </span>
  );
}

export function ProgressBar({
  pct,
  tone = "ink",
  height = 6,
  className = "",
}: {
  pct: number;
  tone?: "ink" | "amber" | "red" | "green";
  height?: number;
  className?: string;
}) {
  const fill = { ink: "bg-ink", amber: "bg-amber", red: "bg-red", green: "bg-green" }[tone];
  return (
    <div className={`rounded-full bg-track ${className}`} style={{ height }} aria-hidden="true">
      <div
        className={`rounded-full ${fill} transition-[width] duration-300`}
        style={{ height, width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

/** Centered dialog over a dimmed page. Esc goes to `closeHref`. */
export function Modal({ label, closeHref, children, maxWidth = 460 }: { label: string; closeHref: string; children: ReactNode; maxWidth?: number }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("input, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.push(closeHref);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router, closeHref]);
  return (
    <div className="scrim-bg flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        style={{ maxWidth }}
        className="flex w-full flex-col gap-6 rounded-[22px] border border-line bg-sheet p-6 shadow-[0_30px_60px_-30px_var(--shadow)] sm:p-8"
      >
        {children}
      </div>
    </div>
  );
}

/** Phone-first column for the member's screens; centered on wide screens. */
export function MemberShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className="min-h-dvh bg-bg">
      <div className={`relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-[22px] py-7 ${className}`}>{children}</div>
    </div>
  );
}

export function NotFound({ what, href, cta }: { what: string; href: string; cta: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg px-4 text-center">
      <span className="font-hand text-4xl font-bold">Nothing on this page.</span>
      <span className="text-mute">{what}</span>
      <Link href={href} className={btn.primarySm}>
        {cta}
      </Link>
    </div>
  );
}
