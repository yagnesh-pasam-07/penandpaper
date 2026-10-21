import { addDays } from "@/lib/time";
import { foldedItems, membersOf, rankedIds, stackLabel, thoughtLabel, visiblePaper, whenLabel, type DropPaper, type Thought } from "./logic";

type Item = { text: string; done: boolean; quiet?: boolean } | { group: string };

/** Open ones first: they're what tomorrow starts with. */
const openFirst = (a: Thought, b: Thought) => (a.status === b.status ? 0 : a.status === "open" ? -1 : 1);
const line = (t: Thought): Item => ({ text: thoughtLabel(t), done: t.status === "done" });

/**
 * The 9 PM email's list: numbered thoughts first, in order, with their
 * numbers; then each stack under its name (or "Stack of N"), the loose tasks,
 * pencil ideas (in grey), and what's folded for the coming week.
 */
export function digestItems(paper: DropPaper): Item[] {
  const shown = visiblePaper(paper);
  const items: Item[] = [];
  const numbered = rankedIds(shown);
  for (const id of numbered) {
    const t = shown.thoughts.find((x) => x.id === id);
    if (t) {
      items.push({ text: `${t.rank}. ${thoughtLabel(t)}`, done: t.status === "done" });
      continue;
    }
    const s = shown.stacks.find((x) => x.id === id);
    if (!s) continue;
    const members = membersOf(shown, s.id);
    items.push({ group: `${s.rank}. ${stackLabel(s, members.length)}` }, ...members.map(line));
  }
  for (const s of shown.stacks) {
    if (numbered.includes(s.id)) continue;
    const members = membersOf(shown, s.id).filter((t) => t.kind === "pen");
    if (!members.length) continue;
    items.push({ group: stackLabel(s, members.length) }, ...members.map(line));
  }
  const loose = shown.thoughts.filter((t) => t.kind === "pen" && !t.stackId && !numbered.includes(t.id)).sort(openFirst);
  if (loose.length && items.length) items.push({ group: "Loose thoughts" });
  items.push(...loose.map(line));

  const ideas = shown.thoughts.filter((t) => t.kind === "pencil" && !numbered.includes(t.id));
  if (ideas.length) items.push({ group: "Ideas" }, ...ideas.map((t) => ({ text: thoughtLabel(t), done: false, quiet: true })));

  const week = addDays(paper.date, 7);
  const soon = foldedItems(paper).filter((f) => f.on <= week);
  if (soon.length) items.push({ group: "Coming up" }, ...soon.map((f) => ({ text: `${whenLabel(f.on, paper.date)} · ${f.label}`, done: false, quiet: true })));
  return items;
}
