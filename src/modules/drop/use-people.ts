"use client";

import { useEffect, useState } from "react";
import { call } from "./chrome";

export type Person = { email: string; name: string | null };

/** The people a paper is shared with: who "@" can suggest. Fetched once per paper, refreshed when a share changes. */
export function usePeople(paperId: string, enabled = true): Person[] {
  const [people, setPeople] = useState<Person[]>([]);
  useEffect(() => {
    // Only the owner can read who a paper is shared with.
    if (!enabled) return;
    let live = true;
    const load = () =>
      void call<{ people: Person[] }>(`/api/drop/papers/${paperId}/share`)
        .then((s) => live && setPeople(s.people))
        .catch(() => {});
    load();
    window.addEventListener("pp-shared", load);
    return () => {
      live = false;
      window.removeEventListener("pp-shared", load);
    };
  }, [paperId, enabled]);
  return people;
}

/** The "@word" being typed just before the cursor, if any (start index and the word). */
export function mentionAt(text: string, cursor: number): { start: number; query: string } | null {
  const m = /(^|\s)@([\w.+-]*)$/.exec(text.slice(0, cursor));
  return m ? { start: cursor - m[2].length - 1, query: m[2].toLowerCase() } : null;
}

/** People whose name or email starts with (or contains) what's typed, best first, at most five. */
export function matchPeople(people: Person[], query: string): Person[] {
  const score = (p: Person) => {
    const name = (p.name ?? "").toLowerCase();
    const email = p.email.toLowerCase();
    if (!query) return 1;
    if (name.split(/\s+/).some((w) => w.startsWith(query)) || email.startsWith(query)) return 2;
    return name.includes(query) || email.includes(query) ? 1 : 0;
  };
  return people
    .map((p) => [p, score(p)] as const)
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([p]) => p);
}

/** How a mention is written into the text: their first name, or their email when no name is known. */
export const mentionText = (p: Person) => `@${p.name?.split(/\s+/)[0] ?? p.email}`;
