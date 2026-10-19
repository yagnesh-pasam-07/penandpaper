import { appUrl } from "@/lib/env";
import { longDate } from "@/lib/time";
import { digestItems } from "@/modules/drop/digest";
import { digestsFor, dropToday } from "@/modules/drop/server";
import { sendMail } from "@/server/email";

/**
 * Vercel Cron, 15:30 UTC = 9 PM IST (vercel.json). Vercel sends
 * `Authorization: Bearer $CRON_SECRET`; anything else is refused.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Not allowed." }, { status: 401 });
  }
  const date = dropToday();
  const digests = await digestsFor(date);
  let sent = 0;
  for (const { email, paper } of digests) {
    const open = paper.thoughts.filter((t) => t.status === "open").length;
    const done = paper.thoughts.length - open;
    const carried = paper.thoughts.filter((t) => t.carriedFrom).length;
    const dropped = paper.thoughts.length - carried;
    const ok = await sendMail({
      to: email,
      subject: `Your paper for ${longDate(date)}`,
      heading: `Today's paper: ${paper.thoughts.length} ${paper.thoughts.length === 1 ? "thought" : "thoughts"}`,
      lines: [
        `${dropped} dropped today${carried ? `, ${carried} carried over` : ""}. ${done} struck out, ${open} still open.`,
        ...(open ? ["Open ones roll over to tomorrow's paper."] : []),
      ],
      items: digestItems(paper),
      cta: { label: "Open my paper", url: `${appUrl}/drop` },
    });
    if (ok) sent += 1;
  }
  return Response.json({ date, papers: digests.length, sent });
}
