import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import { commitMediaIngest } from "~/features/upload";
import { withCSRFProtection } from "~/lib/csrf";
import { logInfo } from "~/lib/error-logger.server";

interface CommitItemPayload {
  fileName: string;
  url: string;
  size: number;
  mimeType: string;
  provider: "S3" | "BLOSSOM_PRIMAL" | "BLOSSOM_BLOSSTR" | "BLOSSOM_SFS";
  sha256?: string;
}

function isCommitItemPayload(value: unknown): value is CommitItemPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  return (
    typeof payload["fileName"] === "string" &&
    typeof payload["url"] === "string" &&
    typeof payload["size"] === "number" &&
    typeof payload["mimeType"] === "string" &&
    typeof payload["provider"] === "string"
  );
}

export const action = withCSRFProtection(
  async ({ request }: ActionFunctionArgs) => {
    try {
      const userId = await requireUserId(request);
      const payload = (await request.json()) as { items?: unknown[] };
      const items = Array.isArray(payload.items) ? payload.items : [];
      if (
        items.length === 0 ||
        !items.every((item) => isCommitItemPayload(item))
      ) {
        return json({ error: "invalid_request" }, { status: 400 });
      }
      const result = await commitMediaIngest(userId, items);
      logInfo("media_commit_completed", {
        userId,
        itemCount: items.length,
        committedCount: result.committed.length,
      });
      return json(result);
    } catch (error) {
      if (error instanceof Response) return error;
      const { handleActionError } = await import("~/lib/error-handler.server");
      return handleActionError(error);
    }
  }
);

export async function loader() {
  return json({ message: "Media commit endpoint" });
}
