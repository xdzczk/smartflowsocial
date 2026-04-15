import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import { getScheduleOverlapWarning } from "~/features/posts/server/scheduling";
import { getUserTimezone } from "~/features/user";
import { withCSRFProtection } from "~/lib/csrf";
import { ValidationError } from "~/lib/errors";
import { parseDateTimeLocal } from "~/lib/temporal";

interface RequestBody {
  scheduledFor?: unknown;
  queueTypeId?: unknown;
  excludeContentId?: unknown;
}

function parseBody(body: unknown): {
  scheduledFor: string;
  queueTypeId: string | null | undefined;
  excludeContentId: string | null;
} {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ValidationError("Request body must be an object");
  }

  const parsed = body as RequestBody;
  const scheduledFor =
    typeof parsed.scheduledFor === "string" ? parsed.scheduledFor.trim() : "";
  if (!scheduledFor) {
    throw new ValidationError("scheduledFor is required");
  }

  const queueTypeId =
    parsed.queueTypeId === null
      ? null
      : typeof parsed.queueTypeId === "string"
        ? parsed.queueTypeId.trim()
        : undefined;
  const normalizedQueueTypeId =
    typeof queueTypeId === "string" && queueTypeId.length === 0
      ? null
      : queueTypeId;

  const excludeContentId =
    typeof parsed.excludeContentId === "string" &&
    parsed.excludeContentId.trim().length > 0
      ? parsed.excludeContentId.trim()
      : null;

  return {
    scheduledFor,
    queueTypeId: normalizedQueueTypeId,
    excludeContentId,
  };
}

export const action = withCSRFProtection(
  async ({ request }: ActionFunctionArgs) => {
    try {
      if (request.method !== "POST") {
        throw new ValidationError("Method not allowed");
      }

      const userId = await requireUserId(request);
      const requestBody = (await request.json()) as unknown;
      const { scheduledFor, queueTypeId, excludeContentId } =
        parseBody(requestBody);

      const timezone = (await getUserTimezone(userId)) ?? "UTC";
      const localScheduled = parseDateTimeLocal(scheduledFor, timezone);
      const targetScheduledAtUtc = new Date(
        Number(localScheduled.withTimeZone("UTC").epochMilliseconds)
      );

      const warning = await getScheduleOverlapWarning({
        userId,
        targetScheduledAtUtc,
        queueTypeId,
        excludeContentId,
      });

      return json({ warning });
    } catch (error) {
      if (error instanceof Response) {
        return error;
      }
      const { handleActionError } = await import("~/lib/error-handler.server");
      return handleActionError(error);
    }
  }
);
