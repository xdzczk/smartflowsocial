import { json, type LoaderFunctionArgs } from "@remix-run/node";

import { connectToPrimalCache } from "~/features/cache/primalCache.server";

/**
 * API route to fetch thread view data from Primal cache
 * GET /api/thread-view?event_id=<event_id>
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const eventId = url.searchParams.get("event_id");

  if (!eventId) {
    return json(
      { error: "Missing event_id parameter" },
      { status: 400 }
    );
  }

  try {
    // Fetch thread view data using centralized cache utility
    const threadViewData = await connectToPrimalCache("thread_view", {
      event_id: eventId,
    });

    // Parse the response to extract events and metadata
    const events: any[] = [];
    const metadata: Record<string, any> = {};

    if (Array.isArray(threadViewData)) {
      for (const item of threadViewData) {
        if (Array.isArray(item) && item[0] === "EVENT" && item[2]) {
          const event = item[2];

          // Add to events array if it's a regular event (not metadata)
          if (event.kind !== 0 && event.kind !== 10000100) {
            events.push(event);
          }

          // Extract user metadata (kind 0 events)
          if (event.kind === 0) {
            metadata[event.pubkey] = event;
          }
        }
      }
    }

    return json({
      events,
      metadata,
      raw: threadViewData, // Include raw data for debugging
    });
  } catch (error) {
    console.error("[API thread-view] Error fetching thread view:", error);
    return json(
      {
        error: "Failed to fetch thread view data",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
