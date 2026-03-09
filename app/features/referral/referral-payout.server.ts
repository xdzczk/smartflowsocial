/**
 * Referral payout: pay referrer via Lightning, mark earnings as paid on success.
 * Uses owner NWC to send payment. paid_at set only on successful payout.
 */

import { NWCClient } from "@getalby/sdk";

import { ReferralEarningStatus } from "~/features/referral/data/referral-prisma-types.server";
import { fetchInvoiceFromLnurlPay } from "~/features/referral/lnurl-pay.server";
import { env } from "~/lib/env.server";
import { logError } from "~/lib/error-logger.server";
import { getOwnerNwcWithRelayOverrides } from "~/models/payment.server";

import {
  aggregatePendingCommissionByReferrer,
  findPendingEarningsForPayout,
  findPendingEarningsWithAttemptCount,
  findReferrerPayoutConfig,
  groupByReferrerPendingSats,
  markEarningPaid,
  markEarningPayoutAttempt,
} from "./repositories/referral-data.server";

const REFERRAL_PAYOUT_MAX_ATTEMPTS = 5;

export async function getPendingBalanceSats(
  referrerNpub: string
): Promise<number> {
  const result = await aggregatePendingCommissionByReferrer(referrerNpub);
  return result._sum.commissionSats ?? 0;
}

/**
 * Pay a BOLT11 invoice with owner NWC and mark referrer's oldest pending earnings as paid.
 * amountSats must match the invoice amount and must be <= pending balance.
 * On success: marks earnings (oldest first) totaling amountSats as PAID and sets paid_at.
 * On failure: increments payout_attempt_count, sets payout_failure_reason; if attempt >= max, sets status FAILED.
 */
export async function payReferrerWithInvoice(
  referrerNpub: string,
  bolt11: string,
  amountSats: number
): Promise<{ success: boolean; error?: string }> {
  const pending = await getPendingBalanceSats(referrerNpub);
  if (amountSats <= 0 || amountSats > pending) {
    return {
      success: false,
      error: "Amount must be positive and not exceed pending balance",
    };
  }

  const ownerNwc = env.OWNER_NWC;
  if (!ownerNwc) {
    return { success: false, error: "OWNER_NWC not configured" };
  }

  const { credentials } = getOwnerNwcWithRelayOverrides(ownerNwc);
  const nwcClient = new NWCClient({ nostrWalletConnectUrl: credentials });

  try {
    await nwcClient.payInvoice({ invoice: bolt11 });
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      referrerNpub,
      message: "Referral payout: payInvoice failed",
    });
    await markPayoutAttemptFailed(
      referrerNpub,
      amountSats,
      String(error instanceof Error ? error.message : error)
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const now = new Date();
  const pendingRows = await findPendingEarningsForPayout(referrerNpub);

  let remaining = amountSats;
  for (const row of pendingRows) {
    if (remaining <= 0) break;
    if (row.commissionSats <= 0) continue;
    await markEarningPaid(row.id, now);
    remaining -= row.commissionSats;
  }

  return { success: true };
}

async function markPayoutAttemptFailed(
  referrerNpub: string,
  amountSats: number,
  reason: string
): Promise<void> {
  const pendingRows = await findPendingEarningsWithAttemptCount(referrerNpub);

  let remaining = amountSats;
  for (const row of pendingRows) {
    if (remaining <= 0) break;
    const mark = Math.min(row.commissionSats, remaining);
    if (mark <= 0) continue;
    const nextCount = row.payoutAttemptCount + 1;
    await markEarningPayoutAttempt(row.id, {
      payoutAttemptCount: nextCount,
      payoutFailureReason: reason,
      status:
        nextCount >= REFERRAL_PAYOUT_MAX_ATTEMPTS
          ? ReferralEarningStatus.FAILED
          : ReferralEarningStatus.PENDING,
    });
    remaining -= row.commissionSats;
  }
}

export async function getEarningsForPayout(
  referrerNpub: string
): Promise<
  Array<{ id: string; commissionSats: number; payoutAttemptCount: number }>
> {
  return findPendingEarningsWithAttemptCount(referrerNpub);
}

const REFERRAL_PAYOUT_THRESHOLD_SATS = 1000;

export async function getReferrersEligibleForPayout(): Promise<
  Array<{ referrerNpub: string; pendingSats: number }>
> {
  const rows = await groupByReferrerPendingSats();

  return rows
    .map((r) => ({
      referrerNpub: r.referrerNpub,
      pendingSats: r._sum.commissionSats ?? 0,
    }))
    .filter((r) => r.pendingSats >= REFERRAL_PAYOUT_THRESHOLD_SATS);
}

export interface ReferralPayoutBatchResult {
  processed: number;
  paid: number;
  failed: number;
  skipped: number;
  errors: string[];
}

/**
 * Run batch referral payout: for each referrer with pending >= threshold and LNURL config, fetch invoice and pay.
 */
export async function runReferralPayoutBatch(): Promise<ReferralPayoutBatchResult> {
  const result: ReferralPayoutBatchResult = {
    processed: 0,
    paid: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  const eligible = await getReferrersEligibleForPayout();

  for (const { referrerNpub, pendingSats } of eligible) {
    result.processed += 1;

    const config = await findReferrerPayoutConfig(referrerNpub);

    if (!config?.payoutDestination.trim()) {
      result.skipped += 1;
      continue;
    }

    const dest = config.payoutDestination.trim();
    const isUrl = dest.startsWith("http://") || dest.startsWith("https://");

    if (!isUrl) {
      result.skipped += 1;
      continue;
    }

    const bolt11 = await fetchInvoiceFromLnurlPay(dest, pendingSats);
    if (!bolt11) {
      result.errors.push(
        `Referrer ${referrerNpub}: failed to fetch LNURL invoice`
      );
      result.failed += 1;
      continue;
    }

    const payResult = await payReferrerWithInvoice(
      referrerNpub,
      bolt11,
      pendingSats
    );

    if (payResult.success) {
      result.paid += 1;
    } else {
      result.failed += 1;
      result.errors.push(
        `Referrer ${referrerNpub}: ${payResult.error ?? "pay failed"}`
      );
    }
  }

  return result;
}
