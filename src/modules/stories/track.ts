"use client";

import type { Channel, EventKind } from "./reach";

const KEY = "pp-reader";

/** A random id this browser keeps for counting readers; never sent anywhere else, no cookie. */
function readerId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID().replace(/-/g, "");
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    // Private mode: a fresh id per page, so it still counts the view.
    return crypto.randomUUID().replace(/-/g, "");
  }
}

/** Tells Story Studio what a reader did. Fire and forget; a failure is ignored. */
export function track(slug: string, kind: EventKind, extra: { channel?: Channel } = {}): void {
  try {
    const params = new URLSearchParams(location.search);
    const body = JSON.stringify({ slug, kind, reader: readerId(), channel: extra.channel, tag: kind === "view" ? (params.get("s") ?? undefined) : undefined, referrer: kind === "view" ? document.referrer.slice(0, 500) || undefined : undefined });
    void fetch("/api/stories/event", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch {}
}
