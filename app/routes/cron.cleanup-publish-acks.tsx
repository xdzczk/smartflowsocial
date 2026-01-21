import { json } from "@remix-run/node";

import { cleanupPublishRelayAcks } from "~/features/relays/publish-relay-ack-retention.server";
import { logError } from "~/lib/error-logger.server";

/**
 * Cron job to clean up PublishRelayAck rows older than the retention window.
 * Intended cadence: daily.
 */
export async function loader() {
  try {
    const result = await cleanupPublishRelayAcks({ olderThanDays: 30 });
    return json(result, { status: 200 });
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      message: "[CRON] Failed to cleanup publish relay ACKs",
    });
    return json({ success: false }, { status: 500 });
  }
}
