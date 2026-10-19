import { membersOf, stackLabel, type DropPaper, type Thought } from "./logic";

type Item = { text: string; done: boolean } | { group: string };

/** Open ones first: they're what tomorrow starts with. */
const openFirst = (a: Thought, b: Thought) => (a.status === b.status ? 0 : a.status === "open" ? -1 : 1);
const line = (t: Thought): Item => ({ text: t.text, done: t.status === "done" });

/** The 9 PM email's list: each stack under its name (or "Stack of N"), then the loose thoughts. */
export function digestItems(paper: DropPaper): Item[] {
  const items: Item[] = [];
  for (const s of paper.stacks) {
    const members = membersOf(paper, s.id);
    if (!members.length) continue;
    items.push({ group: stackLabel(s, members.length) }, ...members.map(line));
  }
  const loose = paper.thoughts.filter((t) => !t.stackId).sort(openFirst);
  if (loose.length && items.length) items.push({ group: "Loose thoughts" });
  return [...items, ...loose.map(line)];
}
