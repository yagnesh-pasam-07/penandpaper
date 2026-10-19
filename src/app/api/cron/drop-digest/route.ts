import { appUrl } from "@/lib/env";
import { longDate } from "@/lib/time";
import { digestItems } from "@/modules/drop/digest";
import { counts, visiblePaper } from "@/modules/drop/logic";
import { digestsFor, dropToday, sweepCrumpled } from "@/modules/drop/server";
import { sendMail } from "@/server/email";

/**
 * Vercel Cron, 15:30 UTC = 9 PM IST (vercel.json). Vercel sends
 * `Authorization: Bearer $CRON_SECRET`; anything else is refused. Also sweeps
 * up thoughts crumpled more than a week ago.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Not allowed." }, { status: 401 });
  }
  const swept = await sweepCrumpled();
  const date = dropToday();
  const digests = await digestsFor(date);
  let sent = 0;
  for (const { email, paper } of digests) {
    const shown = visiblePaper(paper);
    const { open, ideas, done } = counts(paper);
    const carried = shown.thoughts.filter((t) => t.carriedFrom).length;
    const dropped = shown.thoughts.length - carried;
    const ok = await sendMail({
      to: email,
      subject: `Your paper for ${longDate(date)}`,
      heading: `Today's paper: ${shown.thoughts.length} ${shown.thoughts.length === 1 ? "thought" : "thoughts"}`,
      lines: [
        `${dropped} dropped today${carried ? `, ${carried} carried over` : ""}. ${done} struck out, ${open} still open${ideas ? `, ${ideas} ${ideas === 1 ? "idea" : "ideas"} kept` : ""}.`,
        ...(open ? ["30 seconds to clear your desk, or the open ones roll over to tomorrow."] : []),
      ],
      items: digestItems(paper),
      cta: open ? { label: "Clear your desk", url: `${appUrl}/drop/clear` } : { label: "Open my paper", url: `${appUrl}/drop` },
    });
    if (ok) sent += 1;
  }
  return Response.json({ date, papers: digests.length, sent, swept });
}
