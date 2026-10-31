import { sendRecalls } from "@/modules/drop/recall-server";
import { dropZone } from "@/modules/drop/server";

/**
 * Vercel Cron: Thought of the Day notifications (vercel.json). On the Hobby
 * plan a cron runs at most once a day, so this one goes at 03:30 UTC (9 AM
 * IST) and the 9 PM digest sends any that came due since. Each run reaches
 * everyone whose recall time has passed today and who hasn't seen or been
 * sent it yet (`?window=` minutes back, a day by default). On a plan with
 * hourly crons, schedule it hourly with `?window=60` and nothing else changes.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Not allowed." }, { status: 401 });
  }
  const window = Number(new URL(request.url).searchParams.get("window")) || 24 * 60;
  return Response.json(await sendRecalls(new Date(), Math.min(window, 24 * 60), dropZone()));
}
