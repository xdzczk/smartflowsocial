import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import { createDeferredEngagementAction } from "~/features/engagement";
import type { SignedEvent } from "~/features/nostr/types";

function parseBody(value: unknown): {
  eventId: string;
  actionType: "reply" | "quote" | "repost";
  mode: "draft" | "schedule";
  content?: string;
  scheduledFor?: string | null;
  queueTypeId?: string | null;
  signedEvent?: SignedEvent | null;
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
  const mode = body["mode"];
  if (mode === "queue") {
    return null;
  }
  if (mode !== "draft" && mode !== "schedule") {
    return null;
  }
  const signedEventRaw = body["signedEvent"];
  const signedEvent =
    signedEventRaw !== null &&
    signedEventRaw !== undefined &&
    typeof signedEventRaw === "object" &&
    !Array.isArray(signedEventRaw)
      ? (signedEventRaw as SignedEvent)
      : null;

  return {
    eventId: body["eventId"],
    actionType: body["actionType"] as "reply" | "quote" | "repost",
    mode,
    content: typeof body["content"] === "string" ? body["content"] : "",
    scheduledFor:
      typeof body["scheduledFor"] === "string" ? body["scheduledFor"] : null,
    queueTypeId:
      typeof body["queueTypeId"] === "string" ? body["queueTypeId"] : null,
    signedEvent,
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
    const raw: unknown = await request.json();
    if (
      raw &&
      typeof raw === "object" &&
      !Array.isArray(raw) &&
      (raw as Record<string, unknown>)["mode"] === "queue"
    ) {
      return json(
        {
          success: false,
          error: "Queue is not supported for engagement actions",
        },
        { status: 400 }
      );
    }
    const body = parseBody(raw);
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
      signedEvent: body.signedEvent,
    });
    return json({ success: true, ...result });
  } catch (error) {
    if (error instanceof Response) return error;
    const { handleActionError } = await import("~/lib/error-handler.server");
    return handleActionError(error);
  }
}
