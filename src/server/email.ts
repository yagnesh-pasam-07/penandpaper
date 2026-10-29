import "server-only";
import { Resend } from "resend";
import { emailEnabled, env } from "@/lib/env";

type Mail = {
  to: string;
  subject: string;
  heading: string;
  lines: string[];
  /** A checklist: done items struck out, open ones highlighted; a `group` row starts a titled group. */
  items?: ({ text: string; done: boolean; quiet?: boolean } | { group: string })[];
  cta: { label: string; url: string };
  /** Put the button above the list (the evening email leads with "Review tonight's paper"). */
  ctaFirst?: boolean;
  /** A quieter second link under the list. */
  secondary?: { label: string; url: string };
  scheduledAt?: string;
};

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Plain, paper-coloured email that reads fine with images and styles off. */
function render({ heading, lines, items = [], cta, ctaFirst, secondary }: Mail): { html: string; text: string } {
  const ctaRow = `<tr><td style="padding:${ctaFirst ? "10px 0 14px" : "18px 0 0"}"><a href="${esc(cta.url)}" style="display:inline-block;background:#C8382F;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:${ctaFirst ? 18 : 16}px;padding:${ctaFirst ? "16px 28px" : "14px 22px"};border-radius:12px">${esc(cta.label)}</a></td></tr>`;
  const secondaryRow = secondary ? `<tr><td style="font-size:14px;padding-top:14px"><a href="${esc(secondary.url)}" style="color:#5F5B54">${esc(secondary.label)}</a></td></tr>` : "";
  const html = `<!doctype html><html><body style="margin:0;background:#FAF8F3;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1E1D1A">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF8F3;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FFFFFF;border:1px solid #E6E1D7;border-radius:18px;padding:28px">
<tr><td style="font-size:14px;color:#C8382F;font-weight:600;padding-bottom:16px">pen &amp; paper</td></tr>
<tr><td style="font-size:24px;font-weight:600;line-height:1.25;padding-bottom:12px">${esc(heading)}</td></tr>
${lines.map((l) => `<tr><td style="font-size:16px;line-height:1.5;color:#5F5B54;padding-bottom:6px">${esc(l)}</td></tr>`).join("")}
${ctaFirst ? ctaRow : ""}
${items
  .map((i) =>
    "group" in i
      ? `<tr><td style="font-size:13px;font-weight:600;letter-spacing:0.02em;color:#5F5B54;padding:14px 0 4px">${esc(i.group)}</td></tr>`
      : i.quiet
        ? `<tr><td style="font-size:15px;line-height:1.5;padding:4px 10px;color:#8A857C">${esc(i.text)}</td></tr>`
        : i.done
      ? `<tr><td style="font-size:16px;line-height:1.5;padding:6px 10px;color:#5F5B54"><s style="text-decoration-color:#C8382F">${esc(i.text)}</s></td></tr>`
      : `<tr><td style="font-size:16px;line-height:1.5;padding:6px 10px;color:#1E1D1A;background:#FFF1BF;border-radius:8px">${esc(i.text)}</td></tr><tr><td style="height:4px"></td></tr>`,
  )
  .join("")}
${ctaFirst ? "" : ctaRow}
${secondaryRow}
<tr><td style="font-size:13px;color:#5F5B54;padding-top:18px;word-break:break-all">Or open: ${esc(cta.url)}</td></tr>
</table></td></tr></table></body></html>`;
  const ctaText = `${cta.label}: ${cta.url}`;
  const itemLines = items.map((i) => ("group" in i ? `\n${i.group}` : i.done ? `✓ ${i.text} (done)` : `• ${i.text}`));
  const text = [heading, "", ...lines, ...(ctaFirst ? ["", ctaText] : []), ...itemLines, "", ...(ctaFirst ? [] : [ctaText]), ...(secondary ? [`${secondary.label}: ${secondary.url}`] : [])].join("\n");
  return { html, text };
}

/**
 * Sends (or schedules) one email. Without Resend set up, development prints
 * the email to the server log instead; production reports that it can't send.
 */
export async function sendMail(mail: Mail): Promise<boolean> {
  const { html, text } = render(mail);
  if (!emailEnabled || !resend) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`\n[email to ${mail.to}${mail.scheduledAt ? ` at ${mail.scheduledAt}` : ""}]\n${text}\n`);
      return true;
    }
    console.error("Email is not set up (RESEND_API_KEY, EMAIL_FROM); not sent:", mail.subject);
    return false;
  }
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM!,
    to: mail.to,
    subject: mail.subject,
    html,
    text,
    ...(mail.scheduledAt ? { scheduledAt: mail.scheduledAt } : {}),
  });
  if (error) {
    console.error("Resend refused an email:", mail.subject, error.message);
    return false;
  }
  return true;
}
