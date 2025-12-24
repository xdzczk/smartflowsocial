import type { ActionFunctionArgs } from "@remix-run/node";

import { requireUserId } from "~/features/auth/session.server";
import {
  ValidationError,
  ExternalServiceError,
} from "~/lib/errors";
import {
  withActionErrorHandling,
  createSuccessResponse,
  assert,
} from "~/lib/error-handler.server";

export const action = withActionErrorHandling(
  async ({ request }: ActionFunctionArgs) => {
    // Validate HTTP method
    assert(
      request.method === "POST",
      "Method not allowed",
      { method: request.method },
    );

    // Ensure user is authenticated
    await requireUserId(request);

    // Parse and validate request body
    let body: { relays?: unknown; event?: unknown };
    try {
      body = await request.json();
    } catch (error) {
      throw new ValidationError("Invalid JSON in request body", {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }

    const { relays, event } = body;

    // Validate event
    assert(event !== null && event !== undefined, "Event is required", {
      hasEvent: event !== null && event !== undefined,
    });

    // Validate relays
    assert(
      Array.isArray(relays) && relays.length > 0,
      "Relays array is required and must not be empty",
      { relaysType: typeof relays, isArray: Array.isArray(relays) },
    );

    // Validate NOSTR_PUBLISHER_URL is configured
    const publisherUrl = process.env.NOSTR_PUBLISHER_URL;
    assert(
      publisherUrl !== undefined && publisherUrl !== "",
      "NOSTR publisher URL is not configured",
    );

    // Publish to NOSTR_PUBLISHER_URL
    let publishResponse: Response;
    try {
      publishResponse = await fetch(publisherUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          relays,
          event,
        }),
      });
    } catch (error) {
      throw new ExternalServiceError(
        "Failed to connect to NOSTR publisher service",
        503,
        {
          service: "NOSTR_PUBLISHER",
          originalError: error instanceof Error ? error.message : String(error),
        },
      );
    }

    if (!publishResponse.ok) {
      const errorText = await publishResponse.text().catch(() => "Unknown error");
      throw new ExternalServiceError(
        `Failed to publish to nostr: ${publishResponse.status}`,
        publishResponse.status >= 500 ? 502 : publishResponse.status,
        {
          service: "NOSTR_PUBLISHER",
          status: publishResponse.status,
          statusText: publishResponse.statusText,
          errorText,
        },
      );
    }

    // Handle both JSON and text responses
    const contentType = publishResponse.headers.get("content-type");
    let result: unknown;

    try {
      if (contentType && contentType.includes("application/json")) {
        result = await publishResponse.json();
      } else {
        result = await publishResponse.text();
      }
    } catch (error) {
      throw new ExternalServiceError(
        "Failed to parse response from NOSTR publisher",
        502,
        {
          service: "NOSTR_PUBLISHER",
          originalError: error instanceof Error ? error.message : String(error),
        },
      );
    }

    return createSuccessResponse({
      message: "Event published successfully",
      result,
    });
  },
);
