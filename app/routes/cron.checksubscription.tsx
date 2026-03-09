import { json } from "@remix-run/node";

import { checkAndRenewSubscriptions } from "~/features/payments";
import { env } from "~/lib/env.server";

// Polyfill WebSocket for @getalby/sdk in Node.js (production only)
if (
  env.NODE_ENV !== "development" &&
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime polyfill check for Node.js environment
  globalThis.WebSocket === undefined
) {
  const { WebSocket } = require("ws") as {
    WebSocket: typeof globalThis.WebSocket;
  };
  globalThis.WebSocket = WebSocket;
}
/**
 * Cron job to check user subscriptions and handle renewals
 * This should be called periodically (e.g., daily) to:
 * 1. Check subscription expiration
 * 2. Disable accounts with expired subscriptions
 * 3. Attempt automatic renewal for users with NWC enabled
 */
export async function loader() {
  const result = await checkAndRenewSubscriptions();
  return json(result, { status: result.success ? 200 : 500 });
}
