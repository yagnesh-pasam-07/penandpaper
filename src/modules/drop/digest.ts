import { addDays } from "@/lib/time";
import { foldedItems, thoughtLabel, visiblePaper, whenLabel, type DropPaper, type Thought } from "./logic";

type Item = { text: string; done: boolean; quiet?: boolean } | { group: string };

/** Open ones first: they're what tomorrow starts with. */
const openFirst = (a: Thought, b: Thought) => (a.status === b.status ? 0 : a.status === "open" ? -1 : 1);
const line = (t: Thought): Item => ({ text: thoughtLabel(t), done: t.status === "done" });

/**
 * The 9 PM email's list: the tasks (open ones first), pencil ideas (in grey),
 * and what's folded for the coming week.
 */
export function digestItems(paper: DropPaper): Item[] {
  const shown = visiblePaper(paper);
  const items: Item[] = [];
  items.push(...shown.thoughts.filter((t) => t.kind === "pen").sort(openFirst).map(line));

  const ideas = shown.thoughts.filter((t) => t.kind === "pencil");
  if (ideas.length) items.push({ group: "Ideas" }, ...ideas.map((t) => ({ text: thoughtLabel(t), done: false, quiet: true })));

  const week = addDays(paper.date, 7);
  const soon = foldedItems(paper).filter((f) => f.on <= week);
  if (soon.length) items.push({ group: "Coming up" }, ...soon.map((f) => ({ text: `${whenLabel(f.on, paper.date)} · ${f.label}`, done: false, quiet: true })));
  return items;
}
