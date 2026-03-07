import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import {
  createReplyTemplate,
  deleteReplyTemplate,
  listReplyTemplates,
} from "~/features/engagement/engagement-reply-templates.server";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const userId = await requireUserId(request);
    const templates = await listReplyTemplates(userId);
    return json({ templates });
  } catch (error) {
    if (error instanceof Response) return error;
    const { handleLoaderError } = await import("~/lib/error-handler.server");
    return handleLoaderError(error, { templates: [] });
  }
}

function parseJsonBody(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
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
    const body = parseJsonBody(await request.json().catch(() => null));
    const actionType =
      typeof body?.["action"] === "string" ? body["action"] : undefined;

    if (actionType === "create") {
      const slug =
        typeof body?.["slug"] === "string" ? body["slug"] : undefined;
      const templateBody =
        typeof body?.["body"] === "string" ? body["body"] : undefined;
      if (!slug || templateBody === undefined) {
        return json(
          { success: false, error: "slug and body are required" },
          { status: 400 }
        );
      }
      const result = await createReplyTemplate(userId, slug, templateBody);
      if (!result.success) {
        return json(
          { success: false, error: result.error ?? "Failed to create" },
          { status: 400 }
        );
      }
      return json({ success: true });
    }

    if (actionType === "delete") {
      const id = typeof body?.["id"] === "string" ? body["id"] : undefined;
      if (!id) {
        return json(
          { success: false, error: "id is required" },
          { status: 400 }
        );
      }
      const result = await deleteReplyTemplate(userId, id);
      if (!result.success) {
        return json(
          { success: false, error: result.error ?? "Failed to delete" },
          { status: 400 }
        );
      }
      return json({ success: true });
    }

    return json(
      { success: false, error: "action must be create or delete" },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof Response) return error;
    const { handleActionError } = await import("~/lib/error-handler.server");
    return handleActionError(error);
  }
}
