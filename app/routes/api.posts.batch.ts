import { json } from "@remix-run/node";

import { requireUserId } from "~/features/auth/session.server";
import { getPostsByIds } from "~/models/post.server";

export async function action({ request }: { request: Request }) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const userId = await requireUserId(request);
  const { postIds } = await request.json();

  if (!Array.isArray(postIds)) {
    return json({ error: "postIds must be an array" }, { status: 400 });
  }

  try {
    const posts = await getPostsByIds({ ids: postIds, userId });
    return json(posts);
  } catch (error) {
    console.error("Error fetching posts:", error);
    return json({ error: "Failed to fetch posts" }, { status: 500 });
  }
}
