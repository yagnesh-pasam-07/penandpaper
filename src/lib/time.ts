/** Dates are plain "YYYY-MM-DD" strings: a paper belongs to a calendar day, not an instant. */

export function todayIn(tz: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts;
}

function toUtcDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(date: string, days: number): string {
  const d = toUtcDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Next working day (skips Saturday and Sunday). */
export function nextWorkday(date: string): string {
  let next = addDays(date, 1);
  while ([0, 6].includes(toUtcDate(next).getUTCDay())) next = addDays(next, 1);
  return next;
}

/** Previous working day (skips Saturday and Sunday). */
export function prevWorkday(date: string): string {
  let prev = addDays(date, -1);
  while ([0, 6].includes(toUtcDate(prev).getUTCDay())) prev = addDays(prev, -1);
  return prev;
}

export function weekday(date: string): string {
  return toUtcDate(date).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
}

/** "Wed, 22 Oct" */
export function shortDate(date: string): string {
  const d = toUtcDate(date);
  const wd = d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
  const dm = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return `${wd}, ${dm}`;
}

/** "Wednesday, 22 October" */
export function longDate(date: string): string {
  const d = toUtcDate(date);
  const wd = d.toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
  const dm = d.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
  return `${wd}, ${dm}`;
}

/** "28 October 2026" */
export function fullDate(date: string): string {
  return toUtcDate(date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/** Minutes the zone is ahead of UTC at the given instant. */
export function tzOffsetMinutes(tz: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** The instant when the clock in `tz` reads `hh:mm` on `date`. */
export function zonedTime(date: string, hh: number, mm: number, tz: string): Date {
  const guess = new Date(toUtcDate(date).getTime() + (hh * 60 + mm) * 60000);
  const first = new Date(guess.getTime() - tzOffsetMinutes(tz, guess) * 60000);
  // Second pass settles DST edges.
  return new Date(guess.getTime() - tzOffsetMinutes(tz, first) * 60000);
}

/** "9:00", "12:30 pm" style clock as people say it. */
export function clock(at: Date, tz: string, withMeridiem = true): string {
  const s = at
    .toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true })
    .toLowerCase();
  return withMeridiem ? s : s.replace(/\s?(am|pm)$/, "");
}

/** Whether two zones show the same wall-clock time right now. */
export function sameClock(a: string, b: string, at: Date = new Date()): boolean {
  return tzOffsetMinutes(a, at) === tzOffsetMinutes(b, at);
}

/** "Asia/Kolkata" -> "Kolkata" */
export function cityFromTz(tz: string): string {
  return (tz.split("/").pop() ?? tz).replace(/_/g, " ");
}

export function browserTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Common zones for the join screen's "Change" picker. */
export const ZONES: { tz: string; city: string }[] = [
  { tz: "Asia/Kolkata", city: "Hyderabad" },
  { tz: "Asia/Kolkata", city: "Bengaluru" },
  { tz: "Asia/Dubai", city: "Dubai" },
  { tz: "Asia/Singapore", city: "Singapore" },
  { tz: "Asia/Tokyo", city: "Tokyo" },
  { tz: "Australia/Sydney", city: "Sydney" },
  { tz: "Europe/London", city: "London" },
  { tz: "Europe/Berlin", city: "Berlin" },
  { tz: "Europe/Paris", city: "Paris" },
  { tz: "America/New_York", city: "New York" },
  { tz: "America/Toronto", city: "Toronto" },
  { tz: "America/Chicago", city: "Chicago" },
  { tz: "America/Los_Angeles", city: "San Francisco" },
  { tz: "America/Sao_Paulo", city: "São Paulo" },
  { tz: "UTC", city: "UTC" },
];
