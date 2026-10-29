import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Home } from "@/screens/home/home";
import { currentUser } from "@/server/session";

export const metadata: Metadata = {
  title: "Pen & Paper: empty your head onto paper",
  description: "A paper for the thoughts you don't have time to write. Save a thought in a second from the web, your Mac menu bar or Chrome, by typing, pasting or speaking, then see it all on one calm canvas.",
  openGraph: {
    title: "Pen & Paper: empty your head onto paper",
    description: "Save a thought in a second, by typing, pasting or speaking, and see it all on one calm canvas.",
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
      <Home supportEmail={process.env.SUPPORT_EMAIL} />
    </>
  );
}
