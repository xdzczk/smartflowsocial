import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import { runPaidPostAnalyticsSweep } from "~/features/analytics/run-sweep.server";
import { cronJson, denyCronUnlessAuthorized } from "~/lib/cron-http.server";

/**
 * Manual trigger for the paid post-analytics sweep. The worker runs the same
 * function on POST_ANALYTICS_INTERVAL_MINUTES.
 */
async function runPostAnalyticsCron(request?: Request) {
  const denied = denyCronUnlessAuthorized(request);
  if (denied) return denied;
  try {
    const result = await runPaidPostAnalyticsSweep();
    return cronJson({ success: true, ...result });
  } catch (error) {
    return cronJson(
      {
        success: false,
        error: error instanceof Error ? error.message : "Sweep failed",
      },
      500
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
