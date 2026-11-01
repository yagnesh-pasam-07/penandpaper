"use client";

import { useEffect } from "react";
import { track } from "./track";

/**
 * Invisible: counts a view when the story opens, and a read when the reader
 * reaches its last line (seen on screen, after at least 20 seconds, so a
 * quick scroll to the bottom isn't a read). Clears the `?s=` tag from the
 * address bar, so a copied link doesn't carry it on.
 */
export function ReadingSignal({ slug }: { slug: string }) {
  useEffect(() => {
    track(slug, "view");
    const url = new URL(location.href);
    if (url.searchParams.has("s")) {
      url.searchParams.delete("s");
      history.replaceState(history.state, "", url.toString());
    }
    const opened = Date.now();
    const end = document.getElementById("story-end");
    if (!end) return;
    let sent = false;
    const io = new IntersectionObserver((entries) => {
      if (sent || !entries.some((e) => e.isIntersecting)) return;
      if (Date.now() - opened < 20_000) return;
      sent = true;
      track(slug, "read");
      io.disconnect();
    });
    io.observe(end);
    // Reached the end too early: look again once 20 seconds have passed.
    const again = setTimeout(() => {
      io.unobserve(end);
      io.observe(end);
    }, 20_500);
    return () => {
      io.disconnect();
      clearTimeout(again);
    };
  }, [slug]);
  return null;
}
