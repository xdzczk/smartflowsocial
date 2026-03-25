import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import { createDeferredEngagementAction } from "~/features/engagement";

function parseBody(value: unknown): {
  eventId: string;
  actionType: "reply" | "quote" | "repost";
  mode: "draft" | "schedule" | "queue";
  content?: string;
  scheduledFor?: string | null;
  queueTypeId?: string | null;
} | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (
    typeof body["eventId"] !== "string" ||
    typeof body["actionType"] !== "string" ||
    typeof body["mode"] !== "string"
  ) {
    return null;
  }
  return {
    eventId: body["eventId"],
    actionType: body["actionType"] as "reply" | "quote" | "repost",
    mode: body["mode"] as "draft" | "schedule" | "queue",
    content: typeof body["content"] === "string" ? body["content"] : "",
    scheduledFor:
      typeof body["scheduledFor"] === "string" ? body["scheduledFor"] : null,
    queueTypeId:
      typeof body["queueTypeId"] === "string" ? body["queueTypeId"] : null,
  };
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
        { success: false, error: "eventId, actionType, and mode are required" },
        { status: 400 }
      );
    }
    const result = await createDeferredEngagementAction({
      userId,
      eventId: body.eventId,
      actionType: body.actionType,
      mode: body.mode,
      content: body.content,
      scheduledFor: body.scheduledFor,
      queueTypeId: body.queueTypeId,
    });
    return json({ success: true, ...result });
  } catch (error) {
    if (error instanceof Response) return error;
    const { handleActionError } = await import("~/lib/error-handler.server");
    return handleActionError(error);
  }
}
