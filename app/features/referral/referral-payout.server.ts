/**
 * Referral payout: pay referrer via Lightning, mark earnings as paid on success.
 * Uses owner NWC to send payment. paid_at set only on successful payout.
 */

import { NWCClient } from "@getalby/sdk";

import { getOwnerNwcWithRelayOverrides } from "~/features/payments/data";
import { readBolt11ForPayout } from "~/features/referral/bolt11-invoice.server";
import { fetchInvoiceFromLnurlPay } from "~/features/referral/lnurl-pay.server";
import { createReferralPayoutAuditLog } from "~/features/referral/referral-payout-audit.server";
import { env } from "~/lib/env.server";
import { logError } from "~/lib/error-logger.server";

import {
  aggregatePendingCommissionByReferrer,
  beginReferralPayout,
  completeReferralPayoutAttempt,
  failReferralPayoutAttempt,
  findPendingEarningsWithAttemptCount,
  findReferrerPayoutConfig,
  groupByReferrerPendingSats,
} from "./repositories/referral-data.server";

const DEFAULT_MAX_INVOICE_SATS = 1_000_000;
const DEFAULT_DAILY_CAP_SATS = 5_000_000;

const BEGIN_ERRORS: Record<string, string> = {
  INVOICE_ALREADY_SUBMITTED:
    "This invoice was already submitted. Use a new invoice.",
  DAILY_CAP: "Daily referral payout cap exceeded",
  PAYOUT_IN_PROGRESS: "A payout for this referrer is already in progress",
  AMOUNT_NOT_EXACT:
    "Amount must equal a whole prefix of the oldest pending earnings",
};

export async function getPendingBalanceSats(
  referrerNpub: string
): Promise<number> {
  const result = await aggregatePendingCommissionByReferrer(referrerNpub);
  return result._sum.commissionSats ?? 0;
}

export function referralPayoutLimits(
  source: {
    REFERRAL_PAYOUT_MAX_SATS?: string;
    REFERRAL_PAYOUT_DAILY_CAP_SATS?: string;
  } = env
): { maxInvoiceSats: number; dailyCapSats: number } {
  return {
    maxInvoiceSats: positiveInt(
      source.REFERRAL_PAYOUT_MAX_SATS,
      DEFAULT_MAX_INVOICE_SATS
    ),
    dailyCapSats: positiveInt(
      source.REFERRAL_PAYOUT_DAILY_CAP_SATS,
      DEFAULT_DAILY_CAP_SATS
    ),
  };
}

function positiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return fallback;
  return parsed;
}

function startOfUtcDay(now = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
}

/**
 * Pay a BOLT11 invoice with the owner NWC wallet and mark the matching pending
 * earnings paid. The invoice amount must equal `amountSats`. A smaller declared
 * amount cannot authorize a larger invoice.
 */
export async function payReferrerWithInvoice(
  referrerNpub: string,
  bolt11: string,
  amountSats: number,
  audit?: {
    channel: "manual" | "batch";
    operatorNpub?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const channel = audit?.channel ?? "manual";
  const operatorNpub = audit?.operatorNpub;

  const reject = async (errorMessage: string) => {
    await createReferralPayoutAuditLog({
      channel,
      referrerNpub,
      amountSats: Number.isFinite(amountSats) ? amountSats : null,
      status: "failed",
      errorMessage,
      operatorNpub: operatorNpub ?? null,
    });
    return { success: false as const, error: errorMessage };
  };

  const invoice = readBolt11ForPayout(bolt11);
  if (!invoice.ok) return reject(invoice.error);
  if (invoice.amountSats !== amountSats) {
    return reject(
      "Invoice amount does not match the declared amount. Refusing to pay."
    );
  }

  const limits = referralPayoutLimits();
  if (amountSats > limits.maxInvoiceSats) {
    return reject(
      `Invoice exceeds the per-payment cap of ${limits.maxInvoiceSats} sats`
    );
  }

  const pending = await getPendingBalanceSats(referrerNpub);
  if (amountSats < 1 || amountSats > pending) {
    return reject("Amount must be positive and not exceed pending balance");
  }

  const ownerNwc = env.OWNER_NWC?.trim();
  if (!ownerNwc) return reject("OWNER_NWC not configured");

  const begun = await beginReferralPayout({
    referrerNpub,
    amountSats,
    paymentHash: invoice.paymentHash,
    channel,
    operatorNpub: operatorNpub ?? null,
    dailyCapSats: limits.dailyCapSats,
    dayStart: startOfUtcDay(),
  });
  if (!begun.ok) {
    if (begun.error === "ALREADY_PAID") return { success: true };
    return reject(BEGIN_ERRORS[begun.error] ?? "Payout could not be started");
  }

  const { credentials } = getOwnerNwcWithRelayOverrides(ownerNwc);
  const nwcClient = new NWCClient({ nostrWalletConnectUrl: credentials });
  try {
    await nwcClient.payInvoice({ invoice: bolt11 });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logError(error instanceof Error ? error : new Error(errMsg), {
      referrerNpub,
      message: "Referral payout: payInvoice failed",
    });
    await failReferralPayoutAttempt({
      auditId: begun.auditId,
      earningIds: begun.earningIds,
      paymentHash: invoice.paymentHash,
      reason: errMsg,
    });
    return { success: false, error: errMsg };
  }

  try {
    await completeReferralPayoutAttempt({
      auditId: begun.auditId,
      earningIds: begun.earningIds,
      paymentHash: invoice.paymentHash,
      paidAt: new Date(),
    });
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      referrerNpub,
      message:
        "Referral payout: wallet payment succeeded but the ledger update failed",
    });
    return {
      success: false,
      error:
        "Payment may have been sent but the ledger update failed. Do not retry this invoice.",
    };
  }

  return { success: true };
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

export interface ReferralBatchPreviewRow {
  referrerNpub: string;
  pendingSats: number;
  ready: boolean;
  skipReason: string | null;
}

/**
 * Same eligibility rules as batch execution: threshold + https LNURL destination.
 */
export async function getReferralBatchPreview(): Promise<{
  rows: ReferralBatchPreviewRow[];
  totalSatsReady: number;
  readyCount: number;
  skippedCount: number;
}> {
  const eligible = await getReferrersEligibleForPayout();
  const rows: ReferralBatchPreviewRow[] = [];
  let totalSatsReady = 0;
  let readyCount = 0;
  let skippedCount = 0;

  for (const { referrerNpub, pendingSats } of eligible) {
    const config = await findReferrerPayoutConfig(referrerNpub);
    if (!config?.payoutDestination.trim()) {
      rows.push({
        referrerNpub,
        pendingSats,
        ready: false,
        skipReason: "No payout destination configured",
      });
      skippedCount += 1;
      continue;
    }
    const dest = config.payoutDestination.trim();
    const isUrl = dest.startsWith("http://") || dest.startsWith("https://");
    if (!isUrl) {
      rows.push({
        referrerNpub,
        pendingSats,
        ready: false,
        skipReason: "Destination must be an http(s) LNURL/LUD endpoint",
      });
      skippedCount += 1;
      continue;
    }
    rows.push({
      referrerNpub,
      pendingSats,
      ready: true,
      skipReason: null,
    });
    totalSatsReady += pendingSats;
    readyCount += 1;
  }

  return { rows, totalSatsReady, readyCount, skippedCount };
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
export async function runReferralPayoutBatch(options?: {
  operatorNpub?: string;
}): Promise<ReferralPayoutBatchResult> {
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
      pendingSats,
      { channel: "batch", operatorNpub: options?.operatorNpub }
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

  await createReferralPayoutAuditLog({
    channel: "batch",
    status:
      result.failed > 0 && result.paid === 0 && result.processed > 0
        ? "failed"
        : "success",
    batchSummary: result,
    operatorNpub: options?.operatorNpub ?? null,
  });

  return result;
}
