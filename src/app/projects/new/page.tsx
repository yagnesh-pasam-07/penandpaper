import { Suspense } from "react";
import { NewProjectScreen } from "@/screens/projects";

export default function Page() {
  return (
    <Suspense>
      <NewProjectScreen />
    </Suspense>
  );
}
