"use server";

import { revalidateTag, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireWriter } from "@/modules/stories/guard";
import { CATEGORIES, LANGUAGES } from "@/modules/stories/logic";
import { createStory, createTranslation, deleteStory, saveStory, setPublished, STORIES_TAG } from "@/modules/stories/server";

/*
 * Every action checks the writer first (admin role + Studio passcode), on the
 * server: the editor's buttons are only a view of what these allow.
 */

/** Public pages show the change at once (read-your-own-writes). */
function refresh() {
  updateTag(STORIES_TAG);
}

export async function newStory(): Promise<void> {
  const writer = await requireWriter();
  const id = await createStory(writer.id);
  redirect(`/studio/stories/${id}`);
}

const patch = z.object({
  title: z.string().max(200).optional(),
  subtitle: z.string().max(300).optional(),
  hook: z.string().max(240).optional(),
  body: z.string().max(200_000).optional(),
  category: z.enum(CATEGORIES).optional(),
  coverMediaId: z.uuid().nullable().optional(),
  coverCaption: z.string().max(400).optional(),
  audioMediaId: z.uuid().nullable().optional(),
  audioDurationSec: z.number().int().min(0).max(36_000).nullable().optional(),
  originalUrl: z.url().max(500).nullable().optional(),
  shareText: z.string().max(160).optional(),
  shareMediaId: z.uuid().nullable().optional(),
  personName: z.string().max(120).optional(),
  personPlace: z.string().max(120).optional(),
  personPhotoId: z.uuid().nullable().optional(),
  personConsent: z.boolean().optional(),
  series: z.string().max(120).optional(),
  sources: z.string().max(6000).optional(),
  language: z.enum(LANGUAGES).optional(),
});

/** Autosave. Returns the address and reading time as they are now. */
export async function save(id: string, input: z.input<typeof patch>): Promise<{ slug: string; readingMinutes: number } | { error: string }> {
  await requireWriter();
  if (!z.uuid().safeParse(id).success) return { error: "No such story." };
  const parsed = patch.safeParse(input);
  if (!parsed.success) return { error: "That couldn't be saved." };
  const out = await saveStory(id, parsed.data);
  if (!out) return { error: "No such story." };
  revalidateTag(STORIES_TAG, "max");
  return out;
}

/** Publish now, schedule for `at` (ISO), or unpublish (back to a draft). */
export async function publish(id: string, when: "now" | "unpublish" | string): Promise<{ ok: true } | { error: string }> {
  await requireWriter();
  if (!z.uuid().safeParse(id).success) return { error: "No such story." };
  if (when === "unpublish") await setPublished(id, null);
  else {
    const at = when === "now" ? new Date() : new Date(when);
    if (Number.isNaN(at.getTime())) return { error: "That isn't a date." };
    await setPublished(id, at);
  }
  refresh();
  return { ok: true };
}

export async function remove(id: string): Promise<void> {
  await requireWriter();
  if (z.uuid().safeParse(id).success) await deleteStory(id);
  refresh();
  redirect("/studio/stories");
}

/** Brings a Medium post in as a draft, pictures and all, and opens it. */
export async function importFromMedium(_prev: { error: string }, form: FormData): Promise<{ error: string }> {
  const writer = await requireWriter();
  const url = String(form.get("url") ?? "").trim();
  const { importMedium } = await import("@/modules/stories/import-server");
  const res = await importMedium(writer.id, url);
  if ("error" in res) return res;
  redirect(`/studio/stories/${res.id}`);
}

/** Makes (or opens) the Telugu or English version of a story as a draft to translate. */
export async function translate(id: string, language: (typeof LANGUAGES)[number]): Promise<void> {
  const writer = await requireWriter();
  if (!z.uuid().safeParse(id).success || !(LANGUAGES as readonly string[]).includes(language)) return;
  const draft = await createTranslation(id, writer.id, language);
  if (draft) redirect(`/studio/stories/${draft}`);
}
