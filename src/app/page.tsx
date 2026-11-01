import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { storyFonts } from "@/modules/stories/fonts";
import { StoryHome } from "@/screens/story-home";
import { currentUser } from "@/server/session";

export const metadata: Metadata = {
  title: "Pen and Paper: your thoughts deserve to be written down",
  description: "Real stories of real people, to read on the way or listen to. And a quiet desk for your own thoughts.",
  openGraph: {
    title: "Pen and Paper: your thoughts deserve to be written down",
    description: "Real stories of real people. And a quiet desk for your own thoughts.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

/** Someone already signed in goes straight to their paper. */
async function SignedInGoesToPaper() {
  await connection();
  if (await currentUser()) redirect("/drop");
  return null;
}


export default function Page() {
  return (
    <>
      <Suspense fallback={null}>
        <SignedInGoesToPaper />
      </Suspense>
      <div className={storyFonts}>
        <StoryHome />
      </div>
    </>
  );
}
