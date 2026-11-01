import "server-only";
import { studioAdmin, studioOpen } from "@/modules/studio/gate";
import type { User } from "@/server/session";

/**
 * Who may write stories: the same two locks as Studio, both open: the admin
 * role (set only by `npm run set-role`) and the passcode typed in this browser
 * today. Every write (server actions and the upload route) calls this first;
 * the editor's pages only show what it already allows.
 */
export async function storyWriter(): Promise<User | null> {
  const admin = await studioAdmin();
  if (!admin) return null;
  return (await studioOpen(admin.id)) ? admin : null;
}

/** Same, but throws: for server actions, where there is no response to shape. */
export async function requireWriter(): Promise<User> {
  const writer = await storyWriter();
  if (!writer) throw new Error("Only the writer can do that.");
  return writer;
}
