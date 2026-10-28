import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Home } from "@/screens/home/home";
import { currentUser } from "@/server/session";

export const metadata: Metadata = {
  title: "Pen & Paper: empty your head onto paper",
  description: "Drop every thought in two seconds. Fold it for later, and clear your desk every night. Free while in early access.",
  openGraph: {
    title: "Pen & Paper: empty your head onto paper",
    description: "Drop every thought in two seconds. Fold it for later, and clear your desk every night.",
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
