if (process.env.NODE_ENV !== "development") {
  require("websocket-polyfill");
}

import { json } from "@remix-run/node";

import { checkAndRenewSubscriptions } from "~/features/payments/services/subscription-renewal.server";

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
