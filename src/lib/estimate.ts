/**
 * Pulls a time off the end of a dropped thought:
 * "fix calendar overlap 2h" -> { title: "fix calendar overlap", est: 2 }.
 * Accepts 2h, 1.5h, 90m, 1h 30m, 1h30m. No time -> est is null.
 */
export function parseThought(input: string): { title: string; est: number | null } {
  const text = input.trim().replace(/\s+/g, " ");
  const match = text.match(/\s*(?:(\d+(?:\.\d+)?)\s*h(?:rs?|ours?)?)?\s*(?:(\d+)\s*m(?:in(?:s|utes?)?)?)?\s*$/i);
  if (match && (match[1] || match[2]) && match.index !== undefined && match.index > 0) {
    const hours = Number(match[1] ?? 0) + Number(match[2] ?? 0) / 60;
    if (hours > 0) {
      return { title: text.slice(0, match.index).trim(), est: roundToQuarter(hours) };
    }
  }
  return { title: text, est: null };
}

export function roundToQuarter(hours: number): number {
  return Math.round(hours * 4) / 4;
}

/** "1h 30m" style, as on thought bubbles. */
export function formatEstLong(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** "1.5h" style, as in buckets and totals. */
export function formatHours(hours: number): string {
  return `${Number(hours.toFixed(2))}h`;
}

/** Number only, for "7.5 / 8h". */
export function formatNum(hours: number): string {
  return `${Number(hours.toFixed(2))}`;
}
