"use client";

import { useEffect, useSyncExternalStore } from "react";

/** What the server read from a page. Matches `PreviewData` in preview.ts (kept apart so browser code never imports server code). */
export type LinkPreviewData = {
  url: string;
  finalUrl: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  favicon: string | null;
};

const PREFIX = "pp-lp:v1:";
const INDEX = "pp-lp:index";
const KEEP_FOUND_MS = 7 * 24 * 60 * 60 * 1000;
const KEEP_MISSING_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 80;

type Stored = { at: number; data: LinkPreviewData | null };

/** In this page's memory: answers, and requests still on their way (so one link is asked for once however many notes show it). */
const answers = new Map<string, LinkPreviewData | null>();
const asking = new Map<string, Promise<LinkPreviewData | null>>();

function readStored(href: string): Stored | null {
  try {
    const raw = localStorage.getItem(PREFIX + href);
    if (!raw) return null;
    const hit = JSON.parse(raw) as Stored;
    const age = Date.now() - hit.at;
    if (age > (hit.data ? KEEP_FOUND_MS : KEEP_MISSING_MS)) {
      localStorage.removeItem(PREFIX + href);
      return null;
    }
    return hit;
  } catch {
    return null;
  }
}

function store(href: string, data: LinkPreviewData | null) {
  try {
    localStorage.setItem(PREFIX + href, JSON.stringify({ at: Date.now(), data } satisfies Stored));
    const index = (JSON.parse(localStorage.getItem(INDEX) ?? "[]") as string[]).filter((k) => k !== href);
    index.push(href);
    while (index.length > MAX_ENTRIES) {
      const old = index.shift();
      if (old) localStorage.removeItem(PREFIX + old);
    }
    localStorage.setItem(INDEX, JSON.stringify(index));
  } catch {
    // Storage full or off: the answer still lives in memory for this visit.
  }
}

async function ask(href: string): Promise<LinkPreviewData | null> {
  try {
    const res = await fetch(`/api/drop/preview?url=${encodeURIComponent(href)}`, { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as LinkPreviewData;
      store(href, data);
      return data;
    }
    // "Can't be previewed" is worth remembering for a day; being rate-limited, signed out or offline is not.
    if (res.status === 422) store(href, null);
    return null;
  } catch {
    return null;
  }
}

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/**
 * The details of a link's page for a rich card, or null while they are on
 * their way, or when there are none. Asks the server once per link (memory,
 * then this device's storage, then the network), after the first paint so a
 * note never waits for it. Does nothing when `enabled` is false: the homepage
 * paper and read-only views never call the API.
 */
export function useLinkPreview(href: string | null, enabled: boolean): LinkPreviewData | null {
  const data = useSyncExternalStore(
    subscribe,
    () => (href ? (answers.get(href) ?? null) : null),
    () => null,
  );

  useEffect(() => {
    if (!href || !enabled || answers.has(href)) return;
    const stored = readStored(href);
    if (stored) {
      answers.set(href, stored.data);
      emit();
      return;
    }
    const timer = setTimeout(() => {
      const pending = asking.get(href) ?? ask(href).finally(() => asking.delete(href));
      asking.set(href, pending);
      void pending.then((found) => {
        answers.set(href, found);
        emit();
      });
    }, 150);
    return () => clearTimeout(timer);
  }, [href, enabled]);

  return enabled ? data : null;
}
