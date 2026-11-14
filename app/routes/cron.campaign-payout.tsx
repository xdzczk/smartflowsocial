/**
 * Cron: trusted autopay for contests and giveaways.
 * POST is preferred. GET remains accepted for schedulers that already send
 * `X-Cron-Secret` or `Authorization: Bearer`.
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import { runCampaignPayoutAutorunCron } from "~/features/payments";
import { cronJson, denyCronUnlessAuthorized } from "~/lib/cron-http.server";

async function runCampaignCron(request: Request) {
  const denied = denyCronUnlessAuthorized(request);
  if (denied) return denied;
  const result = await runCampaignPayoutAutorunCron();
  return cronJson(result);
}

export async function loader({ request }: LoaderFunctionArgs) {
  return runCampaignCron(request);
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json(
      { error: "Method not allowed" },
      { status: 405, headers: { "Cache-Control": "no-store" } }
    );
  }
  return runCampaignCron(request);
}
