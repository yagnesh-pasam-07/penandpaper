import { Suspense } from "react";
import { ProjectsScreen } from "@/screens/projects";

export default function Page() {
  return (
    <Suspense>
      <ProjectsScreen />
    </Suspense>
  );
}
