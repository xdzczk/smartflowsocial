import type { ActionFunctionArgs } from "@remix-run/node";

import { requireUserId } from "~/features/auth/session.server";
import {
  calculateQueueScheduleTime,
  parseQueueScheduleRequest,
} from "~/features/posts/services/queue-schedule.server";
import { ValidationError } from "~/lib/errors";
import {
  withActionErrorHandling,
  assert,
} from "~/lib/error-handler.server";

export const action = withActionErrorHandling(
  async ({ request }: ActionFunctionArgs) => {
    assert(request.method === "POST", "Method not allowed", {
      method: request.method,
    });

    const userId = await requireUserId(request);

    let requestBody: unknown;
    try {
      requestBody = await request.json();
    } catch (error) {
      throw new ValidationError("Invalid JSON in request body", {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }

    const { queueTypeName, queueTypeId } = parseQueueScheduleRequest(requestBody);

    return calculateQueueScheduleTime(userId, queueTypeName, queueTypeId);
  },
);
