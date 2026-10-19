import { addDays } from "@/lib/time";
import { foldedItems, membersOf, stackLabel, visiblePaper, whenLabel, type DropPaper, type Thought } from "./logic";

type Item = { text: string; done: boolean; quiet?: boolean } | { group: string };

/** Open ones first: they're what tomorrow starts with. */
const openFirst = (a: Thought, b: Thought) => (a.status === b.status ? 0 : a.status === "open" ? -1 : 1);
const line = (t: Thought): Item => ({ text: t.text, done: t.status === "done" });

/**
 * The 9 PM email's list: each stack under its name (or "Stack of N"), then
 * the loose tasks, then pencil ideas (in grey), then what's folded for the
 * coming week.
 */
export function digestItems(paper: DropPaper): Item[] {
  const shown = visiblePaper(paper);
  const items: Item[] = [];
  for (const s of shown.stacks) {
    const members = membersOf(shown, s.id).filter((t) => t.kind === "pen");
    if (!members.length) continue;
    items.push({ group: stackLabel(s, members.length) }, ...members.map(line));
  }
  const loose = shown.thoughts.filter((t) => t.kind === "pen" && !t.stackId).sort(openFirst);
  if (loose.length && items.length) items.push({ group: "Loose thoughts" });
  items.push(...loose.map(line));

  const ideas = shown.thoughts.filter((t) => t.kind === "pencil");
  if (ideas.length) items.push({ group: "Ideas" }, ...ideas.map((t) => ({ text: t.text, done: false, quiet: true })));

  const week = addDays(paper.date, 7);
  const soon = foldedItems(paper).filter((f) => f.on <= week);
  if (soon.length) items.push({ group: "Coming up" }, ...soon.map((f) => ({ text: `${whenLabel(f.on, paper.date)} · ${f.label}`, done: false, quiet: true })));
  return items;
}
