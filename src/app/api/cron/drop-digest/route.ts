import { appUrl } from "@/lib/env";
import { longDate, todayIn } from "@/lib/time";
import { digestItems } from "@/modules/drop/digest";
import { digestsFor, dropZone, sweepCrumpled } from "@/modules/drop/server";
import { sendMail } from "@/server/email";

/**
 * Vercel Cron, 15:30 UTC = 9 PM IST (vercel.json). Vercel sends
 * `Authorization: Bearer $CRON_SECRET`; anything else is refused. Also sweeps
 * up thoughts crumpled and papers deleted more than a week ago.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Not allowed." }, { status: 401 });
  }
  const swept = await sweepCrumpled();
  const zone = dropZone();
  const date = todayIn(zone);
  const digests = await digestsFor(date);
  let sent = 0;
  for (const { email, groups, latestPaperId } of digests) {
    const total = groups.reduce((n, g) => n + g.thoughts.length, 0);
    const struck = groups.reduce((n, g) => n + g.thoughts.filter((t) => t.status === "done").length, 0);
    const ok = await sendMail({
      to: email,
      subject: `What you dropped on ${longDate(date)}`,
      heading: "Here's what you dropped today",
      lines: [`${total} ${total === 1 ? "thought" : "thoughts"} on ${groups.length} ${groups.length === 1 ? "paper" : "papers"}${struck ? `, ${struck} struck out` : ""}.`],
      items: digestItems(groups),
      cta: { label: "Open my paper", url: `${appUrl}/drop${latestPaperId ? `/${latestPaperId}` : ""}` },
    });
    if (ok) sent += 1;
  }
  return Response.json({ date, people: digests.length, sent, swept });
}
