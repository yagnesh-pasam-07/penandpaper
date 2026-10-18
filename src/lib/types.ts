/** Tint slot used for a person's avatar and their thought bubbles. */
export type Tint = "t1" | "t2" | "t3" | "t4" | "t5";

export type Lead = {
  name: string;
  email: string;
};

export type Member = {
  id: string;
  name: string;
  email: string;
  /** IANA time zone, e.g. "Europe/Berlin". */
  tz: string;
  city: string;
  /** Working hours per day. */
  hours: number;
  tint: Tint;
  status: "invited" | "joined";
  /** Dates (YYYY-MM-DD) this person is on leave. */
  leave: string[];
};

export type CarryReason = "Took longer" | "Blocked" | "Other work" | "Unclear";

export type TimeRequest = {
  hours: number;
  why: string;
  /** ISO timestamp. */
  at: string;
  state: "pending" | "given" | "kept";
};

export type Task = {
  id: string;
  title: string;
  /** Estimate in hours; null until the lead gives it a time. */
  est: number | null;
  /** null while it is still a loose thought on the paper. */
  assigneeId: string | null;
  done: boolean;
  doneAt?: string;
  /** Date of the paper this task rolled over from. */
  carriedFrom?: string;
  /** What the owner said when it rolled over, e.g. "took longer". */
  carryNote?: string;
  blocked?: { why: string; at: string };
  request?: TimeRequest;
  /** Visual variety for thought bubbles on the canvas. */
  shape: number;
};

export type Paper = {
  /** YYYY-MM-DD, the day this paper plans. */
  date: string;
  status: "draft" | "sent";
  sentAt?: string;
  tasks: Task[];
  /** Per member: when they closed their day and why work was left. */
  closed: Record<string, { at: string; reason?: CarryReason }>;
  thanked?: boolean;
};

export type Project = {
  id: string;
  name: string;
  hoursPerDay: 6 | 8;
  inviteCode: string;
  createdAt: string;
  leadTz: string;
  leadCity: string;
  invitesSent: boolean;
  members: Member[];
  /** The working day the lead is on. */
  currentDate: string;
  papers: Paper[];
};
