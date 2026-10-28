import { thoughtLabel, type DigestGroup } from "./logic";

type Item = { text: string; done: boolean } | { group: string };

/**
 * The evening email's list: each paper that got thoughts today as a heading,
 * its thoughts under it in the order they were written, struck ones lined through.
 */
export function digestItems(groups: DigestGroup[]): Item[] {
  return groups.flatMap((g): Item[] => [{ group: g.title }, ...g.thoughts.map((t) => ({ text: thoughtLabel(t), done: t.status === "done" }))]);
}
