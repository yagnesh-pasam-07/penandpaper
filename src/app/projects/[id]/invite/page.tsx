import { Suspense } from "react";
import { InviteScreen } from "@/screens/projects";

export default function Page() {
  return (
    <Suspense>
      <InviteScreen />
    </Suspense>
  );
}
