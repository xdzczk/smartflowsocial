/**
 * Cron: trusted autopay for contests + giveaways.
 *
 * Eligibility:
 * - campaign is LOCKED (or payout-in-progress for contests)
 * - payoutAutoRunEnabled is true
 * - payoutWalletMode is nwc_creator
 * - contest end has passed (for contests)
 *
 * Safety:
 * - skips when a run is already "running" and recently started (lease-like guard)
 */

import { json } from "@remix-run/node";

import { runCampaignPayoutAutorunCron } from "~/features/payments";

export async function loader() {
  const result = await runCampaignPayoutAutorunCron();
  return json(result, { status: 200 });
}
