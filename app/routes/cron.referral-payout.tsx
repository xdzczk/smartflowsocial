/**
 * Cron: run referral payout batch (weekly or as configured).
 * Selects referrers with pending balance >= threshold and LNURL payout destination; fetches invoice and pays.
 */

import { json } from "@remix-run/node";

import { runReferralPayoutBatch } from "~/features/referral/referral-payout.server";

export async function loader() {
  const result = await runReferralPayoutBatch();
  return json(result, { status: 200 });
}
