import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import { withCSRFProtection } from "~/lib/csrf.server";
import { ValidationError, ExternalServiceError } from "~/lib/errors";

type AssertFunction = (
  condition: boolean,
  message: string,
  context?: Record<string, unknown>,
) => asserts condition;

export const action = withCSRFProtection(async ({ request }: ActionFunctionArgs) => {
  try {
    const errorHandler = await import("~/lib/error-handler.server");
    const assert: AssertFunction = errorHandler.assert;

    // Validate HTTP method
    assert(request.method === "POST", "Method not allowed", {
      method: request.method,
    });

    // Ensure user is authenticated
    await requireUserId(request);

    // Parse and validate request body
    let bodyRaw: unknown;
    try {
      bodyRaw = await request.json();
    } catch (error) {
      throw new ValidationError("Invalid JSON in request body", {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }

    const body =
      bodyRaw && typeof bodyRaw === "object" && bodyRaw !== null
        ? (bodyRaw as { relays?: unknown; event?: unknown })
        : {};
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
      const errorText = await publishResponse
        .text()
        .catch(() => "Unknown error");
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
      if (
        contentType &&
        typeof contentType === "string" &&
        contentType.includes("application/json")
      ) {
        const jsonResult: unknown = await publishResponse.json();
        result = jsonResult;
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

    // Return simple success response
    // If result is a string (text response), include it as message
    if (typeof result === "string") {
      return json({ success: true, message: result });
    }
    // For JSON responses, just return success
    return json({ success: true });
  } catch (error) {
    // If error is a Response (e.g., redirect from requireUserId), return it
    if (error instanceof Response) {
      return error;
    }
    // Use dynamic import to avoid bundling issues
    const { handleActionError } = await import("~/lib/error-handler.server");
    return handleActionError(error);
  }
});
