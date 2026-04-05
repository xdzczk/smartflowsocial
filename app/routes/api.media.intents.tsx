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

interface IntentRequestPayload {
  files?: unknown[];
  selectedProvider?: string;
  composeSessionId?: string;
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
      const payload = (await request.json()) as IntentRequestPayload;
      const files = Array.isArray(payload.files) ? payload.files : [];
      if (
        files.length === 0 ||
        !files.every((file) => isIntentFilePayload(file))
      ) {
        return json({ error: "invalid_request" }, { status: 400 });
      }
      const intent = await createMediaIngestIntent(userId, files, {
        composeSessionId:
          typeof payload.composeSessionId === "string"
            ? payload.composeSessionId
            : undefined,
      });
      const requestId = request.headers.get("x-request-id") ?? undefined;
      logInfo("media_intent_created", {
        userId,
        fileCount: files.length,
        selectedProvider:
          typeof payload.selectedProvider === "string"
            ? payload.selectedProvider
            : null,
        resolvedProvider: intent.provider,
        source: "resolved_upload_provider_settings",
        commercialPlanType: null,
        intentId: intent.intentId,
        composeSessionId:
          typeof payload.composeSessionId === "string"
            ? payload.composeSessionId
            : null,
        requestId,
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
