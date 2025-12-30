import type { ActionFunctionArgs } from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import {
  calculateQueueScheduleTime,
  parseQueueScheduleRequest,
} from "~/features/posts";
import {
  withActionErrorHandling,
  assert,
} from "~/lib/error-handler.server";
import { ValidationError } from "~/lib/errors";

export const action = withActionErrorHandling(
  async ({ request }: ActionFunctionArgs) => {
    assert(request.method === "POST", "Method not allowed", {
      method: request.method,
    });

    const userId = await requireUserId(request);

    let requestBody: unknown;
    try {
      const jsonResult: unknown = await request.json();
      requestBody = jsonResult;
    } catch (error) {
      throw new ValidationError("Invalid JSON in request body", {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }

    const { queueTypeName, queueTypeId } = parseQueueScheduleRequest(requestBody);

    return calculateQueueScheduleTime(userId, queueTypeName, queueTypeId);
  },
);
