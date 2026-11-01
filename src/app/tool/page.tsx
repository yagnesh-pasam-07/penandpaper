import type { Metadata } from "next";
import { storyFonts } from "@/modules/stories/fonts";
import { Home } from "@/screens/home/home";

export const metadata: Metadata = {
  title: "The Tool · Pen & Paper",
  description: "A paper for the thoughts you don't have time to write. Save a thought in a second from the web, your Mac menu bar or Chrome, by typing, pasting or speaking, then see it all on one calm canvas.",
  alternates: { canonical: "/tool" },
  openGraph: { title: "Pen & Paper: the thinking tool", description: "Save a thought in a second, by typing, pasting or speaking, and see it all on one calm canvas.", type: "website", url: "/tool" },
};

/** The thinking tool's own page: everything the homepage used to say about it. */
export default function ToolPage() {
  return (
    <div className={storyFonts}>
      <Home supportEmail={process.env.SUPPORT_EMAIL} />
    </div>
  );
}
