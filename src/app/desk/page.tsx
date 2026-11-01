import type { Metadata } from "next";
import { storyFonts } from "@/modules/stories/fonts";
import { Home } from "@/screens/home/home";

export const metadata: Metadata = {
  title: "Desk · Pen and Paper",
  description: "A paper for the thoughts you don't have time to write. Save a thought in a second from the web, your Mac menu bar or Chrome, by typing, pasting or speaking, then see it all on one calm canvas.",
  alternates: { canonical: "/desk" },
  openGraph: { title: "Pen and Paper Desk: a quiet place for your thoughts", description: "Save a thought in a second, by typing, pasting or speaking, and see it all on one calm canvas.", type: "website", url: "/desk" },
};

/** Pen and Paper Desk: the thinking tool's own page. */
export default function DeskPage() {
  return (
    <div className={storyFonts}>
      <Home supportEmail={process.env.SUPPORT_EMAIL} />
    </div>
  );
}
