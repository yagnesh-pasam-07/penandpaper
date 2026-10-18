import { Suspense } from "react";
import { ProjectHomeScreen } from "@/screens/projects";

export default function Page() {
  return (
    <Suspense>
      <ProjectHomeScreen />
    </Suspense>
  );
}
