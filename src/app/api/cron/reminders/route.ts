import { sendReminders } from "@/modules/drop/reminders-server";
import { dropZone } from "@/modules/drop/server";

/**
 * Reminders on their own, for a plan with hourly crons (Vercel Pro): schedule
 * this hourly in vercel.json and reminders land within the hour. On Hobby the
 * two daily jobs send them instead.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Not allowed." }, { status: 401 });
  }
  return Response.json(await sendReminders(new Date(), dropZone()));
}
