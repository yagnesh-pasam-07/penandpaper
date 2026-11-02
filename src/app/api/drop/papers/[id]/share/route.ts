import { z } from "zod";
import { appUrl } from "@/lib/env";
import { checkEmail } from "@/lib/email-check";
import { mailServers } from "@/lib/email-dns";
import { paperTitle } from "@/modules/drop/logic";
import { noStore, requireUser } from "@/modules/drop/http";
import { allowWithin } from "@/modules/drop/rate";
import { invite, setPublicLink, shareState, uninvite } from "@/modules/drop/share-server";
import { sendMail } from "@/server/email";

const gone = () => Response.json({ error: "That paper isn't there." }, { status: 404 });

/** Who this paper is shared with, and its public link (if on). Owner only. */
export async function GET(_request: Request, ctx: RouteContext<"/api/drop/papers/[id]/share">) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return gone();
  const state = await shareState(user.id, id);
  return state ? Response.json(state, noStore) : gone();
}

const body = z.union([
  /** Someone already on the paper was @mentioned: tell them, with the words. */
  z.object({ mention: z.string().trim().max(254), words: z.string().trim().max(400) }),
  z.object({ invite: z.string().trim().max(254) }),
  z.object({ remove: z.string().trim().max(254) }),
  z.object({ link: z.boolean(), reset: z.boolean().optional() }),
]);

/** Invite a person by email, remove one, or turn the public link on/off (or make a new one). */
export async function POST(request: Request, ctx: RouteContext<"/api/drop/papers/[id]/share">) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return gone();
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "That didn't come through." }, { status: 400 });
  const b = parsed.data;

  if ("mention" in b) {
    const email = b.mention.toLowerCase();
    const state = await shareState(user.id, id);
    if (!state) return gone();
    // Only people the paper is already shared with: a mention never shares by itself.
    if (!state.people.some((p) => p.email === email)) return Response.json({ error: "They aren't on this paper yet. Share it with them first." }, { status: 400 });
    if (!(await allowWithin(`share-mention:${user.id}`, 40, 86_400_000))) return Response.json({ error: "That's a lot of mentions today. Try tomorrow." }, { status: 429 });
    await sendMail({
      to: email,
      subject: `${user.name || user.email} mentioned you`,
      heading: `${user.name || user.email} mentioned you on a paper`,
      lines: [`"${b.words}"`],
      cta: { label: "Open the paper", url: `${appUrl}/drop/shared/${id}` },
    }).catch(() => false);
    return Response.json(state, noStore);
  }
  if ("invite" in b) {
    const email = b.invite.toLowerCase();
    if (email === user.email.toLowerCase()) return Response.json({ error: "That's you: it's already yours." }, { status: 400 });
    const problem = await checkEmail(email, mailServers);
    if (problem) return Response.json({ error: problem.message, suggestion: problem.suggestion }, { status: 400 });
    // Twenty invites a day, so sharing can't be used to send mail at people.
    if (!(await allowWithin(`share-invite:${user.id}`, 20, 86_400_000))) return Response.json({ error: "That's enough invites for today. Try again tomorrow." }, { status: 429 });
    const r = await invite(user.id, id, email);
    if (!r.ok) return gone();
    if (r.added) {
      const title = paperTitle({ name: r.name });
      await sendMail({
        to: email,
        subject: `${user.name || user.email} shared "${title}" with you`,
        heading: `${user.name || user.email} shared a paper with you`,
        lines: [`"${title}", on Pen & Paper. You can look; it's read-only.`, `Sign in with ${email} to open it.`],
        cta: { label: "Open the paper", url: `${appUrl}/drop/shared/${id}` },
      }).catch(() => false);
    }
  } else if ("remove" in b) {
    if (!(await uninvite(user.id, id, b.remove))) return gone();
  } else {
    if ((await setPublicLink(user.id, id, b.link, b.reset)) === undefined) return gone();
  }
  const state = await shareState(user.id, id);
  return state ? Response.json(state, noStore) : gone();
}
