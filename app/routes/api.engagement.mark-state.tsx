import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import { markEngagementItemState } from "~/features/engagement/engagement-mark-state.server";

function parseBody(
  value: unknown
): { eventId: string; repliedFromApp?: boolean } | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const eventId = body["eventId"];
  if (typeof eventId !== "string") return null;
  const repliedFromApp =
    typeof body["repliedFromApp"] === "boolean"
      ? body["repliedFromApp"]
      : undefined;
  return { eventId, repliedFromApp };
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json(
      { success: false, error: "Method not allowed" },
      { status: 405 }
    );
  }

  try {
    const userId = await requireUserId(request);
    const body = parseBody(await request.json());
    if (!body) {
      return json(
        { success: false, error: "eventId is required" },
        { status: 400 }
      );
    }

    const result = await markEngagementItemState(userId, {
      eventId: body.eventId,
      repliedFromApp: body.repliedFromApp,
    });

    if (!result.success) {
      return json(
        { success: false, error: result.error ?? "Failed to update state" },
        { status: 400 }
      );
    }

    return json({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    const { handleActionError } = await import("~/lib/error-handler.server");
    return handleActionError(error);
  }
}
