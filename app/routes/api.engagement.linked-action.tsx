import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import { upsertLinkedActionForEngagementItem } from "~/features/engagement/repositories/engagement-item-state.server";

function parseBody(value: unknown): {
  eventId: string;
  kind:
    | "DRAFT"
    | "SCHEDULED_REPLY"
    | "SCHEDULED_QUOTE"
    | "SCHEDULED_REPOST"
    | "QUEUED_REPLY"
    | "QUEUED_QUOTE"
    | "QUEUED_REPOST";
  state?:
    | "UNHANDLED"
    | "DRAFTED"
    | "SCHEDULED"
    | "REPLIED"
    | "IGNORED"
    | "SNOOZED"
    | "HANDLED";
  postId?: string | null;
  draftId?: string | null;
  queueTypeId?: string | null;
  label?: string | null;
  scheduledFor?: string | null;
} | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const eventId = body["eventId"];
  const kind = body["kind"];
  if (typeof eventId !== "string" || typeof kind !== "string") return null;
  return {
    eventId,
    kind: kind as
      | "DRAFT"
      | "SCHEDULED_REPLY"
      | "SCHEDULED_QUOTE"
      | "SCHEDULED_REPOST"
      | "QUEUED_REPLY"
      | "QUEUED_QUOTE"
      | "QUEUED_REPOST",
    state:
      typeof body["state"] === "string"
        ? (body["state"] as
            | "UNHANDLED"
            | "DRAFTED"
            | "SCHEDULED"
            | "REPLIED"
            | "IGNORED"
            | "SNOOZED"
            | "HANDLED")
        : undefined,
    postId: typeof body["postId"] === "string" ? body["postId"] : null,
    draftId: typeof body["draftId"] === "string" ? body["draftId"] : null,
    queueTypeId:
      typeof body["queueTypeId"] === "string" ? body["queueTypeId"] : null,
    label: typeof body["label"] === "string" ? body["label"] : null,
    scheduledFor:
      typeof body["scheduledFor"] === "string" ? body["scheduledFor"] : null,
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
        { success: false, error: "eventId and kind are required" },
        { status: 400 }
      );
    }
    await upsertLinkedActionForEngagementItem({
      userId,
      eventId: body.eventId,
      kind: body.kind,
      state: body.state,
      postId: body.postId,
      draftId: body.draftId,
      queueTypeId: body.queueTypeId,
      label: body.label,
      scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null,
    });
    return json({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    const { handleActionError } = await import("~/lib/error-handler.server");
    return handleActionError(error);
  }
}
