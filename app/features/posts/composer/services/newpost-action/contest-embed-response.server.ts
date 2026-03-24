/**
 * When the composer is embedded (e.g. contest creation), return JSON instead of
 * redirecting to /dashboard/newpost so the host page stays mounted.
 */

import { json } from "@remix-run/node";

import { getPostById } from "~/features/posts/server";

export function isContestEmbedRequest(formData: FormData): boolean {
  return String(formData.get("_embedContext") ?? "") === "contest";
}

export async function jsonContestEmbedPost(
  userId: string,
  postId: string
): Promise<Response> {
  const post = await getPostById({ id: postId, userId });
  if (!post) {
    return json({ error: "Post not found after publish" }, { status: 500 });
  }
  return json({
    ok: true,
    embedContext: "contest" as const,
    postId: post.id,
    nostrEventId: post.nostrEventId,
    caption: post.caption,
    publishedAt:
      post.publishedAt instanceof Date ? post.publishedAt.toISOString() : null,
  });
}
