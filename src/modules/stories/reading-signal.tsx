"use client";

import { useEffect } from "react";
import { track } from "./track";

/** A reader who hasn't scrolled, tapped or typed for this long is not reading. */
const IDLE_MS = 30_000;
/** At most one depth update this often while reading (plus one when they leave). */
const SEND_EVERY_MS = 15_000;

/**
 * Invisible: counts a view when the story opens, and a read when the reader
 * reaches its last line (seen on screen, after at least 20 seconds, so a
 * quick scroll to the bottom isn't a read). Clears the `?s=` tag from the
 * address bar, so a copied link doesn't carry it on.
 *
 * Attention: how far they got (the deepest paragraph that came into view)
 * and how long they actively read (tab visible, not idle for 30 s). Sent as
 * one depth row per reader that only moves forward, so Studio can show where
 * people stop. Anonymous, like every other count.
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

    // ---- Read to the end ----
    const end = document.getElementById("story-end");
    let sentRead = false;
    const io = new IntersectionObserver((entries) => {
      if (sentRead || !entries.some((e) => e.isIntersecting)) return;
      if (Date.now() - opened < 20_000) return;
      sentRead = true;
      track(slug, "read");
      io.disconnect();
    });
    if (end) io.observe(end);
    const again = setTimeout(() => {
      if (!end || sentRead) return;
      io.unobserve(end);
      io.observe(end);
    }, 20_500);

    // ---- Depth: the deepest paragraph seen ----
    let deepest = -1;
    const blocks = document.querySelectorAll<HTMLElement>("[data-block]");
    const depthIo = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const i = Number(e.target.getAttribute("data-block"));
          if (Number.isFinite(i) && i > deepest) deepest = i;
        }
      },
      // Counts once a third of the paragraph is on screen.
      { threshold: 0.33 },
    );
    blocks.forEach((b) => depthIo.observe(b));

    // ---- Active time: visible and not idle ----
    let active = 0;
    let lastInput = Date.now();
    let lastTick = Date.now();
    const poke = () => {
      lastInput = Date.now();
    };
    const inputs = ["scroll", "pointerdown", "keydown", "touchstart", "wheel"] as const;
    inputs.forEach((ev) => window.addEventListener(ev, poke, { passive: true }));
    const tick = setInterval(() => {
      const now = Date.now();
      if (document.visibilityState === "visible" && now - lastInput < IDLE_MS) active += now - lastTick;
      lastTick = now;
    }, 1000);

    // ---- Send: every 15 s if something moved, and when they leave ----
    let sentDepth = -1;
    let sentSeconds = 0;
    const send = () => {
      const seconds = Math.round(active / 1000);
      if (deepest < 0 && seconds < 3) return;
      if (deepest === sentDepth && seconds - sentSeconds < 5) return;
      sentDepth = deepest;
      sentSeconds = seconds;
      track(slug, "depth", { depth: Math.max(0, deepest), seconds });
    };
    const every = setInterval(send, SEND_EVERY_MS);
    const onHide = () => {
      if (document.visibilityState === "hidden") send();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", send);

    return () => {
      send();
      io.disconnect();
      depthIo.disconnect();
      clearTimeout(again);
      clearInterval(tick);
      clearInterval(every);
      inputs.forEach((ev) => window.removeEventListener(ev, poke));
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", send);
    };
  }, [slug]);
  return null;
}
