import "server-only";
import { unnoticedPosts } from "@/modules/stories/unnoticed";

/** Live hearts per post from Instagram (only with INSTAGRAM_TOKEN; cached an hour). Empty without it. */
export async function liveLikes(): Promise<Record<string, number>> {
  const posts = await unnoticedPosts();
  return Object.fromEntries((posts ?? []).filter((p) => p.likes !== null).map((p) => [p.code, p.likes!]));
}
