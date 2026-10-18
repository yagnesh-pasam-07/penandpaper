"use client";

import { useParams } from "next/navigation";
import { useStore } from "./store";
import type { Project } from "./types";

/** The project named by the `[id]` route segment. */
export function useProject(): Project | undefined {
  const { id } = useParams<{ id: string }>();
  return useStore((s) => s.projects.find((p) => p.id === id));
}
