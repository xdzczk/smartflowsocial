import { json, type LoaderFunctionArgs } from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import { loadSearchThreadChildReplies } from "~/features/search";

const EVENT_ID_HEX = /^[a-f0-9]{64}$/i;

/**
 * Lazy nested replies for search post viewer: direct children of `parent_event_id`.
 * GET /api/search/thread-replies?parent_event_id=<64-char hex>
 */
export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  const url = new URL(request.url);
  const parentId = url.searchParams.get("parent_event_id")?.trim() ?? "";
  const parentNorm = parentId.toLowerCase();
  if (!EVENT_ID_HEX.test(parentNorm)) {
    return json(
      {
        parent_event_id: parentNorm,
        error: "Invalid parent_event_id",
        replies: [] as const,
      },
      { status: 400 }
    );
  }

  try {
    const { replies } = await loadSearchThreadChildReplies(parentNorm);
    return json({ parent_event_id: parentNorm, replies });
  } catch {
    return json(
      {
        parent_event_id: parentNorm,
        error: "Failed to load nested replies",
        replies: [] as const,
      },
      { status: 502 }
    );
  }
}
