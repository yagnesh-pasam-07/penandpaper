import { z } from "zod";
import { noStore, requireUser } from "@/modules/drop/http";
import { addDevice, removeDevice } from "@/modules/drop/recall-server";
import { isSameSite } from "@/modules/drop/share";
import { isPushEndpoint } from "@/server/web-push";

const sub = z.object({
  endpoint: z.string().url().max(1000).refine(isPushEndpoint, "Not a push service."),
  keys: z.object({ p256dh: z.string().regex(/^[A-Za-z0-9_-]{80,100}$/), auth: z.string().regex(/^[A-Za-z0-9_-]{16,32}$/) }),
});

/** `POST { subscription, device }`: this device gets the daily notification. Same-site only. */
export async function POST(request: Request) {
  if (!isSameSite(request.headers, new URL(request.url).origin)) return Response.json({ error: "Not from this site." }, { status: 403 });
  const user = await requireUser();
  if (user instanceof Response) return user;
  const parsed = z.object({ subscription: sub, device: z.string().max(60).nullable().optional() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "This browser's notifications didn't come through." }, { status: 400 });
  await addDevice(user.id, parsed.data.subscription, parsed.data.device ?? null);
  return new Response(null, { status: 204, ...noStore });
}

/** `DELETE { endpoint }`: this device stops getting it. */
export async function DELETE(request: Request) {
  if (!isSameSite(request.headers, new URL(request.url).origin)) return Response.json({ error: "Not from this site." }, { status: 403 });
  const user = await requireUser();
  if (user instanceof Response) return user;
  const parsed = z.object({ endpoint: z.string().max(1000) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Which device?" }, { status: 400 });
  await removeDevice(user.id, parsed.data.endpoint);
  return new Response(null, { status: 204, ...noStore });
}
