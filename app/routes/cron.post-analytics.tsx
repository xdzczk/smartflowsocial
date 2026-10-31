import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import { runPaidPostAnalyticsSweep } from "~/features/analytics/run-sweep.server";
import { cronRequestAuthorized } from "~/lib/cron-auth.server";
import { env } from "~/lib/env.server";

/**
 * Manual trigger for the paid post-analytics sweep. The worker runs the same
 * function on POST_ANALYTICS_INTERVAL_MINUTES.
 */
async function runPostAnalyticsCron(request?: Request) {
  if (!cronRequestAuthorized(request, env.CRON_SECRET)) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runPaidPostAnalyticsSweep();
    return json({ success: true, ...result });
  } catch (error) {
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Sweep failed",
      },
      { status: 500 }
    );
  }
}

export async function loader(args?: LoaderFunctionArgs) {
  return runPostAnalyticsCron(args?.request);
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }
  return runPostAnalyticsCron(request);
}
