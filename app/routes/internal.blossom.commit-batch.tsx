import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { json } from "@remix-run/node";

import { commitBlossomBatch, type CommitItem } from "~/features/upload";
import { env } from "~/lib/env.server";
import { logInfo } from "~/lib/error-logger.server";
import { buildSeoMeta, siteOriginFromMatches } from "~/lib/seo";

export const meta: MetaFunction = ({ matches }) =>
  buildSeoMeta(
    { page: "Internal", robots: "noindex, nofollow" },
    { siteOrigin: siteOriginFromMatches(matches) }
  );

function isCommitItem(value: unknown): value is CommitItem {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["jti"] === "string" &&
    typeof v["pubkey"] === "string" &&
    typeof v["sha256"] === "string" &&
    typeof v["size"] === "number" &&
    typeof v["url"] === "string"
  );
}

function authorizeInternalRequest(request: Request): boolean {
  const configured = env.BLOSSOM_INTERNAL_SECRET?.trim() ?? "";
  const provided = request.headers.get("x-internal-secret") ?? "";
  return configured !== "" && configured === provided;
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    if (!authorizeInternalRequest(request)) {
      return json({ error: "unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      batchId?: string;
      items?: unknown[];
    };
    if (!body.batchId || !Array.isArray(body.items)) {
      return json({ error: "invalid_request" }, { status: 400 });
    }
    if (!body.items.every((item) => isCommitItem(item))) {
      return json({ error: "invalid_request" }, { status: 400 });
    }

    const result = await commitBlossomBatch(body.batchId, body.items);
    logInfo("Blossom commit-batch processed", {
      batchId: body.batchId,
      processed: result.processed,
      duplicate: result.duplicate,
      failed: result.failed,
    });
    return json(result);
  } catch (error) {
    const { handleActionError } = await import("~/lib/error-handler.server");
    return handleActionError(error);
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  if (!authorizeInternalRequest(request)) {
    return json({ error: "unauthorized" }, { status: 401 });
  }
  return json({ message: "Internal Blossom commit-batch endpoint" });
}
