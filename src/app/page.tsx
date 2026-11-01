import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { storyFonts } from "@/modules/stories/fonts";
import { StoryHome } from "@/screens/story-home";
import { currentUser } from "@/server/session";

export const metadata: Metadata = {
  title: "Pen and Paper: every person is a story",
  description: "Real people, written down. Short stories of ordinary lives, history and art, to read on the way or listen to. And a quiet place for your own thoughts.",
  openGraph: {
    title: "Pen and Paper: every person is a story",
    description: "Real people, written down. Read a story on the way, or listen.",
    type: "website",
  },
};

/** Someone already signed in goes straight to their paper. */
async function SignedInGoesToPaper() {
  await connection();
  if (await currentUser()) redirect("/drop");
  return null;
}

// The homepage is light paper unless the visitor has picked a theme themselves.
const lightByDefault = `(function(){try{if(!localStorage.getItem("pp-theme"))document.documentElement.setAttribute("data-theme","light")}catch(e){}})()`;

export default function Page() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: lightByDefault }} />
      <Suspense fallback={null}>
        <SignedInGoesToPaper />
      </Suspense>
      <div className={storyFonts}>
        <StoryHome />
      </div>
    </>
  );
}
