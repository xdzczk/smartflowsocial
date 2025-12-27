import type { LoaderFunctionArgs } from "@remix-run/node";

import { connectToPrimalCache } from "~/features/cache/primalCache.server";
import {
  withErrorHandling,
  assert,
} from "~/lib/error-handler.server";
import {
  ExternalServiceError,
} from "~/lib/errors";

/**
 * API route to fetch thread view data from Primal cache
 * GET /api/thread-view?event_id=<event_id>
 */
export const loader = withErrorHandling(
  async ({ request }: LoaderFunctionArgs) => {
    const url = new URL(request.url);
    const eventId = url.searchParams.get("event_id");

    assert(eventId !== null, "Missing event_id parameter", {
      searchParams: Array.from(url.searchParams.entries()),
    });

    // Fetch thread view data using centralized cache utility
    let threadViewData: unknown;
    try {
      threadViewData = await connectToPrimalCache("thread_view", {
        event_id: eventId,
      });
    } catch (error) {
      throw new ExternalServiceError(
        "Failed to fetch thread view data from cache",
        502,
        {
          service: "PrimalCache",
          eventId,
          originalError: error instanceof Error ? error.message : String(error),
        },
      );
    }

    // Parse the response to extract events and metadata
    const events: unknown[] = [];
    const metadata: Record<string, unknown> = {};

    if (Array.isArray(threadViewData)) {
      for (const item of threadViewData) {
        if (!Array.isArray(item) || item[0] !== "EVENT" || !item[2]) continue;
        const eventData: unknown = item[2] as unknown;
        if (!eventData || typeof eventData !== "object" || Array.isArray(eventData)) continue;
        const event = eventData as { kind?: number; pubkey?: string; content?: string; id?: string; tags?: string[][]; created_at?: number };

        // Add to events array if it's a regular event (not metadata)
        if (event.kind !== 0 && event.kind !== 10000100) {
          events.push(event);
        }

        // Extract user metadata (kind 0 events)
        if (event.kind === 0 && event.pubkey && typeof event.pubkey === "string") {
          metadata[event.pubkey] = event;
        }
      }
    }

    return {
      events,
      metadata,
      raw: threadViewData, // Include raw data for debugging
    };
  },
);
