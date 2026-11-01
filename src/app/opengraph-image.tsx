import { OG_SIZE, renderCard } from "@/modules/stories/og-card";

export const alt = "Pen and Paper: your thoughts deserve to be written down";
export const size = OG_SIZE;
export const contentType = "image/jpeg";

/** The card for the homepage and any page without its own: the brand and its belief. */
export default function Image(): Promise<Response> {
  return renderCard({
    kicker: "Pen and Paper",
    title: "Your thoughts deserve to be written down.",
    line: "Real stories of real people. And a quiet desk for your own thoughts.",
    meta: "Stories · Desk",
  });
}
