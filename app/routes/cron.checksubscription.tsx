import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import { checkAndRenewSubscriptions } from "~/features/payments";
import { cronRequestAuthorized } from "~/lib/cron-auth.server";
import { env } from "~/lib/env.server";
import { ensureServerWebSocket } from "~/lib/websocket-polyfill.server";

ensureServerWebSocket();

/**
 * Manual trigger for the subscription renewal sweep. The worker runs the same
 * function on SUBSCRIPTION_RENEWAL_INTERVAL_MINUTES. This route does not have
 * to be called for renewals to happen.
 */
async function runSubscriptionCron(request?: Request) {
  if (!cronRequestAuthorized(request, env.CRON_SECRET)) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await checkAndRenewSubscriptions();
  return json(result, { status: result.success ? 200 : 500 });
}

export async function loader(args?: LoaderFunctionArgs) {
  return runSubscriptionCron(args?.request);
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }
  return runSubscriptionCron(request);
}
