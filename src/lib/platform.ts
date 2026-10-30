"use client";

import { useSyncExternalStore } from "react";

export type Platform = "mac" | "windows" | "other";

/** Which computer the visitor is on, from what the browser says about itself. iPhone and iPad count as Mac (same keys). */
export function detectPlatform(nav: { platform?: string; userAgent?: string; userAgentData?: { platform?: string } }): Platform {
  const said = `${nav.userAgentData?.platform ?? ""} ${nav.platform ?? ""} ${nav.userAgent ?? ""}`.toLowerCase();
  if (/mac|iphone|ipad|ipod/.test(said)) return "mac";
  if (/win/.test(said)) return "windows";
  return "other";
}

const noSubscribe = () => () => {};

/**
 * The visitor's platform; null while the server renders and during hydration,
 * so the first paint matches and the right keys swap in straight after.
 */
export function usePlatform(): Platform | null {
  return useSyncExternalStore(
    noSubscribe,
    () => detectPlatform(navigator as Navigator & { userAgentData?: { platform?: string } }),
    () => null,
  );
}

/** Keys as a Mac shows them (⌥ ⇧ ⌘) or as Windows and Linux name them (Alt Shift Ctrl). */
const NAMES: Record<string, string> = { "⌥": "Alt", "⇧": "Shift", "⌘": "Ctrl", "⌃": "Ctrl" };

/** A shortcut written the Mac way, in the visitor's own keys. Before the platform is known, both ("⌘/Ctrl"). */
export function keysFor(mac: string[], platform: Platform | null): string[] {
  if (platform === "mac") return mac;
  if (platform) return mac.map((k) => NAMES[k] ?? k);
  return mac.map((k) => (NAMES[k] ? `${k}/${NAMES[k]}` : k));
}

/** A shortcut as one line of text: "⌘⇧M" on a Mac, "Ctrl+Shift+M" elsewhere. */
export function shortcutText(mac: string[], platform: Platform | null): string {
  const keys = keysFor(mac, platform);
  return platform === "mac" ? keys.join("") : keys.join("+");
}
