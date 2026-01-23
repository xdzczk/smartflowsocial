import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import { getPostStats } from "~/features/posts/stats.server";
import { withCSRFProtection } from "~/lib/csrf";
import { ValidationError } from "~/lib/errors";

type AssertFunction = (
  condition: boolean,
  message: string,
  context?: Record<string, unknown>
) => asserts condition;

/**
 * API route to fetch post stats for multiple event IDs
 * POST /api/post-stats
 * Body: { eventIds: string[] }
 * Returns: { stats: Record<string, PostStats> }
 */
export const action = withCSRFProtection(
  async ({ request }: ActionFunctionArgs) => {
    try {
      // Require authentication
      await requireUserId(request);

      const errorHandler = await import("~/lib/error-handler.server");
      const assert: AssertFunction = errorHandler.assert;

      // Validate HTTP method
      assert(request.method === "POST", "Method not allowed", {
        method: request.method,
      });

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
        typeof bodyRaw === "object" && bodyRaw !== null
          ? (bodyRaw as { eventIds?: unknown })
          : {};

      const { eventIds } = body;

      // Validate eventIds
      assert(Array.isArray(eventIds), "eventIds must be an array", {
        eventIdsType: typeof eventIds,
        isArray: Array.isArray(eventIds),
      });

      assert(eventIds.length > 0, "eventIds array must not be empty", {
        eventIdsLength: eventIds.length,
      });

      // Validate all eventIds are strings
      assert(
        eventIds.every((id) => typeof id === "string"),
        "All eventIds must be strings",
        {
          eventIds,
        }
      );

      const eventIdsArray = eventIds;

      // Fetch stats using the optimized function
      const stats = await getPostStats(eventIdsArray);

      return json({ stats });
    } catch (error) {
      // If error is a Response (e.g., redirect from requireUserId), return it
      if (error instanceof Response) {
        return error;
      }
      // Use dynamic import to avoid bundling issues
      const { handleLoaderError } = await import("~/lib/error-handler.server");
      return handleLoaderError(error, {});
    }
  }
);
