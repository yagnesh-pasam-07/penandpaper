"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { isEveningLocal, TZ_COOKIE } from "./tonight";

/**
 * A small "Tonight" link in the header. It shows only in the evening (18:00 or
 * later on the viewer's own clock) and only while today still has thoughts to
 * review; it looks again when the window gets focus, and on the minute, so it
 * appears at six without a reload. Never shown once the review is closed.
 */
export function TonightButton() {
  const [left, setLeft] = useState<number | null>(null);

  const check = useCallback(async () => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz || !isEveningLocal(new Date(), tz)) {
      setLeft(null);
      return;
    }
    // The server works out "today" from this cookie, so it is set before asking.
    document.cookie = `${TZ_COOKIE}=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
    try {
      const res = await fetch("/api/drop/tonight?lite=1", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { remaining: number; completed: boolean };
      setLeft(!data.completed && data.remaining > 0 ? data.remaining : null);
    } catch {
      // Offline: leave it as it was.
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(() => void check(), 0);
    const onFocus = () => document.visibilityState === "visible" && void check();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    const every = setInterval(onFocus, 60_000);
    return () => {
      clearTimeout(first);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      clearInterval(every);
    };
  }, [check]);

  if (left === null) return null;
  return (
    <Link
      href="/tonight"
      title="Review what you dropped today"
      className="rounded-lg px-2.5 py-2 text-sm font-medium text-red-text hover:bg-red-soft focus-visible:bg-red-soft"
    >
      Tonight<span className="ml-1.5 font-normal text-mute">{left}</span>
    </Link>
  );
}
