import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import { createMediaIngestIntent } from "~/features/upload";
import { withCSRFProtection } from "~/lib/csrf";
import { logInfo } from "~/lib/error-logger.server";

interface IntentFilePayload {
  fileName: string;
  size: number;
  mimeType: string;
  sha256?: string;
}

function isIntentFilePayload(value: unknown): value is IntentFilePayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  return (
    typeof payload["fileName"] === "string" &&
    typeof payload["size"] === "number" &&
    typeof payload["mimeType"] === "string"
  );
}

export const action = withCSRFProtection(
  async ({ request }: ActionFunctionArgs) => {
    try {
      const userId = await requireUserId(request);
      const payload = (await request.json()) as { files?: unknown[] };
      const files = Array.isArray(payload.files) ? payload.files : [];
      if (
        files.length === 0 ||
        !files.every((file) => isIntentFilePayload(file))
      ) {
        return json({ error: "invalid_request" }, { status: 400 });
      }
      const intent = await createMediaIngestIntent(userId, files);
      logInfo("media_intent_created", {
        userId,
        fileCount: files.length,
        provider: intent.provider,
      });
      return json(intent);
    } catch (error) {
      if (error instanceof Response) return error;
      const { handleActionError } = await import("~/lib/error-handler.server");
      return handleActionError(error);
    }
  }
);

export async function loader() {
  return json({ message: "Media intent endpoint" });
}
