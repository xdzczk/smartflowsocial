import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import { cleanupPublishRelayAcks } from "~/features/relays/publish-relay-ack-retention.server";
import { cronJson, denyCronUnlessAuthorized } from "~/lib/cron-http.server";
import { logError } from "~/lib/error-logger.server";

/**
 * Cron job to clean up PublishRelayAck rows older than the retention window.
 * Intended cadence: daily. POST is preferred.
 */
async function runCleanupCron(request: Request) {
  const denied = denyCronUnlessAuthorized(request);
  if (denied) return denied;
  try {
    const result = await cleanupPublishRelayAcks({ olderThanDays: 30 });
    return cronJson(result);
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      message: "[CRON] Failed to cleanup publish relay ACKs",
    });
    return cronJson({ success: false }, 500);
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  return runCleanupCron(request);
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json(
      { error: "Method not allowed" },
      { status: 405, headers: { "Cache-Control": "no-store" } }
    );
  }
  return runCleanupCron(request);
}
