import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import { issueBlossomBulkTokens } from "~/features/upload";
import { withCSRFProtection } from "~/lib/csrf";

interface TokenRequestFile {
  sha256: string;
  size: number;
  type: string;
  filename?: string;
}

interface TokenRequestPayload {
  files?: unknown[];
  intentId?: unknown;
  requestedProvider?: unknown;
}

function isTokenRequestFile(value: unknown): value is TokenRequestFile {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["sha256"] === "string" &&
    typeof v["size"] === "number" &&
    typeof v["type"] === "string"
  );
}

export const action = withCSRFProtection(
  async ({ request }: ActionFunctionArgs) => {
    try {
      const userId = await requireUserId(request);
      const body = (await request.json()) as TokenRequestPayload;

      const files = Array.isArray(body.files) ? body.files : [];
      if (!files.every((file) => isTokenRequestFile(file))) {
        return json({ error: "invalid_request" }, { status: 400 });
      }
      const intentId =
        typeof body.intentId === "string" ? body.intentId : undefined;
      const requestedProvider =
        typeof body.requestedProvider === "string"
          ? body.requestedProvider
          : undefined;
      if (!intentId || !requestedProvider) {
        return json({ error: "invalid_request" }, { status: 400 });
      }

      const result = await issueBlossomBulkTokens(userId, files, {
        intentId,
        requestedProvider,
        requestId: request.headers.get("x-request-id") ?? undefined,
      });
      return json(result);
    } catch (error) {
      if (error instanceof Response) {
        return error;
      }
      const message = error instanceof Error ? error.message : String(error);
      if (
        message.includes("MEDIA_PROVIDER_MISMATCH") ||
        message.includes("media_intent_")
      ) {
        return json(
          {
            error: "MEDIA_PROVIDER_MISMATCH",
            message:
              "Media provider mismatch detected. Please refresh and try again.",
          },
          { status: 409 }
        );
      }
      if (
        message.includes("batch size exceeds") ||
        message.includes("files array is required")
      ) {
        return json({ error: "invalid_request" }, { status: 400 });
      }
      const { handleActionError } = await import("~/lib/error-handler.server");
      return handleActionError(error);
    }
  }
);

export async function loader() {
  return json({ message: "Blossom bulk token endpoint" });
}
