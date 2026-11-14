/**
 * Cron: run the referral payout batch.
 * POST is preferred. GET remains accepted when the cron secret matches.
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import {
  referralPayoutsEnabled,
  runReferralPayoutBatch,
} from "~/features/referral/referral-payout.server";
import { cronJson, denyCronUnlessAuthorized } from "~/lib/cron-http.server";
import { env } from "~/lib/env.server";

async function runReferralCron(request: Request) {
  const denied = denyCronUnlessAuthorized(request);
  if (denied) return denied;
  if (!referralPayoutsEnabled(env.REFERRAL_PAYOUTS_ENABLED)) {
    return cronJson({ error: "Referral payouts are disabled" }, 403);
  }
  const result = await runReferralPayoutBatch();
  return cronJson(result);
}

export async function loader({ request }: LoaderFunctionArgs) {
  return runReferralCron(request);
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json(
      { error: "Method not allowed" },
      { status: 405, headers: { "Cache-Control": "no-store" } }
    );
  }
  return runReferralCron(request);
}
