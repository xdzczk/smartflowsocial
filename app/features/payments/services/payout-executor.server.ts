import crypto from "node:crypto";

import { NWCClient } from "@getalby/sdk";

import {
  fetchPrimalProfileData,
  processPrimalData,
} from "~/features/auth/profile.server";
import {
  createPayoutAttempt,
  findOrCreatePayoutRunByIdempotencyKey,
  updatePayoutAttemptByIdempotencyKey,
  updatePayoutItem,
  updatePayoutRun,
  upsertPayoutItemByRunAndWinner,
  withPayoutLedgerTransaction,
} from "~/features/payments/repositories/payout-ledger-data.server";
import { fetchInvoiceFromLnurlPay } from "~/features/referral/lnurl-pay.server";
import { getDecryptedUserNWC } from "~/features/user";
import { logError } from "~/lib/error-logger.server";
import { nostrAdapter } from "~/lib/nostr-adapter.server";

export type CampaignPayoutScope = "CONTEST" | "GIVEAWAY";
export type CampaignWalletMode = "manual" | "nwc_creator";
export type CampaignPayoutTrigger = "manual_trigger" | "autorun";

export type PayoutEligibility =
  | { eligible: true; walletMode: "nwc_creator"; nwc: string }
  | {
      eligible: false;
      walletMode: "manual";
      errorCode:
        | "nwc_not_connected"
        | "nwc_disabled"
        | "nwc_decrypt_failed"
        | "nwc_missing";
      errorMessage: string;
    };

export interface WinnerPayoutInput {
  winnerPubkeyHex: string;
  amountSats: number;
  /** Optional. If not provided, will be derived from pubkey. */
  winnerNpub?: string | null;
  /** Optional. If already known, avoids profile fetch. */
  lnAddressSnapshot?: string | null;
}

export interface ExecuteCampaignPayoutBatchInput {
  scope: CampaignPayoutScope;
  contestId?: string;
  giveawayId?: string;
  creatorUserId: string;
  trigger: CampaignPayoutTrigger;
  walletMode: CampaignWalletMode;
  spendCapSats?: number | null;
  winners: WinnerPayoutInput[];
}

export interface ExecuteCampaignPayoutBatchResult {
  runId: string | null;
  walletMode: CampaignWalletMode;
  eligible: boolean;
  eligibilityErrorCode?: string;
  eligibilityErrorMessage?: string;
  totals: {
    items: number;
    paid: number;
    failed: number;
    claimNeeded: number;
    skipped: number;
  };
}

type PayoutTx = Parameters<
  Parameters<typeof withPayoutLedgerTransaction>[0]
>[0];

function stableHash(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function campaignIdempotencyKey(input: {
  scope: CampaignPayoutScope;
  contestId?: string;
  giveawayId?: string;
}): string {
  if (input.scope === "CONTEST" && input.contestId) {
    return `contest:${input.contestId}`;
  }
  if (input.scope === "GIVEAWAY" && input.giveawayId) {
    return `giveaway:${input.giveawayId}`;
  }
  return `${input.scope.toLowerCase()}:unknown`;
}

function winnerItemIdempotencyKey(args: {
  scope: CampaignPayoutScope;
  contestId?: string;
  giveawayId?: string;
  winnerPubkeyHex: string;
  amountSats: number;
}): string {
  const campaignKey = campaignIdempotencyKey(args);
  return stableHash(
    `${campaignKey}:winner:${args.winnerPubkeyHex}:amount:${args.amountSats}`
  );
}

function attemptIdempotencyKey(args: {
  payoutItemId: string;
  attemptNumber: number;
}): string {
  return stableHash(`${args.payoutItemId}:attempt:${args.attemptNumber}`);
}

function lud16ToLnurlPayUrl(lud16: string): string | null {
  const trimmed = lud16.trim().toLowerCase();
  const at = trimmed.indexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return null;
  const user = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  return `https://${domain}/.well-known/lnurlp/${user}`;
}

async function fetchLud16ForNpub(npub: string): Promise<string | null> {
  try {
    const primalData = await fetchPrimalProfileData(npub);
    const { profile } = processPrimalData(primalData);
    return typeof profile.lud16 === "string" && profile.lud16.trim() !== ""
      ? profile.lud16.trim()
      : null;
  } catch {
    return null;
  }
}

async function resolveInvoiceForWinner(args: {
  winnerNpub: string;
  amountSats: number;
  lnAddressSnapshot?: string | null;
}): Promise<
  | { ok: true; lnAddressSnapshot: string; invoice: string }
  | { ok: false; code: "missing_destination" | "invoice_fetch_failed" }
> {
  const snapshotAddress = args.lnAddressSnapshot?.trim();
  const fetchedAddress = snapshotAddress
    ? null
    : await fetchLud16ForNpub(args.winnerNpub);
  const lnAddress = snapshotAddress ?? fetchedAddress ?? "";
  if (!lnAddress) return { ok: false, code: "missing_destination" };
  const lnurlPayUrl = lud16ToLnurlPayUrl(lnAddress);
  if (!lnurlPayUrl) return { ok: false, code: "missing_destination" };
  const invoice = await fetchInvoiceFromLnurlPay(lnurlPayUrl, args.amountSats);
  if (!invoice) return { ok: false, code: "invoice_fetch_failed" };
  return { ok: true, lnAddressSnapshot: lnAddress, invoice };
}

async function getEligibility(
  creatorUserId: string,
  walletMode: CampaignWalletMode
): Promise<PayoutEligibility> {
  if (walletMode !== "nwc_creator") {
    return {
      eligible: false,
      walletMode: "manual",
      errorCode: "nwc_disabled",
      errorMessage: "Wallet mode is manual",
    };
  }
  const decrypted = await getDecryptedUserNWC(creatorUserId);
  if (!decrypted) {
    return {
      eligible: false,
      walletMode: "manual",
      errorCode: "nwc_not_connected",
      errorMessage: "Creator has no connected NWC wallet",
    };
  }
  return { eligible: true, walletMode: "nwc_creator", nwc: decrypted };
}

async function payInvoiceWithTimeout(
  nwc: string,
  invoice: string,
  timeoutMs: number
): Promise<
  | { ok: true; preimage?: string; walletResponse?: unknown }
  | { ok: false; error: Error }
> {
  const client = new NWCClient({ nostrWalletConnectUrl: nwc });
  try {
    const payPromise = client.payInvoice({ invoice });
    const res = await Promise.race([
      payPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("NWC payInvoice timeout")), timeoutMs)
      ),
    ]);
    const obj =
      typeof res === "object" && !Array.isArray(res)
        ? (res as Record<string, unknown>)
        : {};
    const preimage =
      typeof obj["preimage"] === "string" ? obj["preimage"] : undefined;
    return { ok: true, preimage, walletResponse: res };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
  } finally {
    try {
      client.close();
    } catch {
      // ignore
    }
  }
}

async function ensureRun(tx: PayoutTx, input: ExecuteCampaignPayoutBatchInput) {
  const idKey = campaignIdempotencyKey(input);
  return findOrCreatePayoutRunByIdempotencyKey(tx, {
    idempotencyKey: idKey,
    scope: input.scope,
    userId: input.creatorUserId,
    walletMode: input.walletMode,
    trigger: input.trigger,
    contestId: input.contestId ?? null,
    giveawayId: input.giveawayId ?? null,
    spendCapSats: input.spendCapSats ?? null,
    totalItems: input.winners.length,
    totalSats: input.winners.reduce(
      (acc, w) => acc + Math.max(0, w.amountSats),
      0
    ),
  });
}

export async function executeCampaignPayoutBatch(
  input: ExecuteCampaignPayoutBatchInput
): Promise<ExecuteCampaignPayoutBatchResult> {
  const eligibility = await getEligibility(
    input.creatorUserId,
    input.walletMode
  );

  // Always create the run record (idempotent per campaign) so UI/cron can explain why nothing happened.
  const run = await withPayoutLedgerTransaction(async (tx) => {
    const r = await ensureRun(tx, input);
    if (!eligibility.eligible) {
      await updatePayoutRun(r.id, {
        status: "skipped",
        eligibilityErrorCode: eligibility.errorCode,
        eligibilityErrorMessage: eligibility.errorMessage,
        completedAt: new Date(),
      });
    } else {
      await updatePayoutRun(r.id, {
        status: "running",
        startedAt: r.startedAt ?? new Date(),
        eligibilityErrorCode: null,
        eligibilityErrorMessage: null,
      });
    }
    return r;
  });

  if (!eligibility.eligible) {
    return {
      runId: run.id,
      walletMode: "manual",
      eligible: false,
      eligibilityErrorCode: eligibility.errorCode,
      eligibilityErrorMessage: eligibility.errorMessage,
      totals: {
        items: input.winners.length,
        paid: 0,
        failed: 0,
        claimNeeded: 0,
        skipped: input.winners.length,
      },
    };
  }

  const nwc = eligibility.nwc;
  let paid = 0;
  let failed = 0;
  let claimNeeded = 0;
  let skipped = 0;

  for (const w of input.winners) {
    const amountSats = Math.max(0, Math.floor(w.amountSats));
    if (amountSats <= 0) {
      skipped += 1;
      continue;
    }

    const itemKey = winnerItemIdempotencyKey({
      scope: input.scope,
      contestId: input.contestId,
      giveawayId: input.giveawayId,
      winnerPubkeyHex: w.winnerPubkeyHex,
      amountSats,
    });

    // Ensure item row exists (idempotent per run + winner).
    const item = await upsertPayoutItemByRunAndWinner({
      runId: run.id,
      winnerPubkey: w.winnerPubkeyHex,
      amountSats,
      idempotencyKey: itemKey,
    });

    const winnerNpub = (w.winnerNpub ?? "").trim()
      ? (w.winnerNpub ?? "").trim()
      : nostrAdapter.encodeNpub(w.winnerPubkeyHex);
    if (!winnerNpub) {
      claimNeeded += 1;
      await updatePayoutItem(item.id, {
        status: "claim_needed",
        errorCode: "missing_destination",
        errorMessage: "Invalid winner pubkey (cannot derive npub)",
      });
      continue;
    }

    // Skip already-paid items.
    if (item.status === "paid" || item.status === "skipped") {
      skipped += 1;
      continue;
    }

    // Resolve invoice just-in-time.
    const inv = await resolveInvoiceForWinner({
      winnerNpub,
      amountSats,
      lnAddressSnapshot: w.lnAddressSnapshot ?? null,
    });
    if (!inv.ok) {
      claimNeeded += 1;
      await updatePayoutItem(item.id, {
        status: "claim_needed",
        errorCode: inv.code,
        errorMessage:
          inv.code === "missing_destination"
            ? "Winner has no Lightning address"
            : "Could not fetch invoice from LNURL pay endpoint",
      });
      continue;
    }

    const nextAttemptNumber = item.attemptCount + 1;
    const attemptKey = attemptIdempotencyKey({
      payoutItemId: item.id,
      attemptNumber: nextAttemptNumber,
    });

    await createPayoutAttempt({
      runId: run.id,
      itemId: item.id,
      attemptNumber: nextAttemptNumber,
      idempotencyKey: attemptKey,
    });

    await updatePayoutItem(item.id, {
      invoice: inv.invoice,
      lnAddressSnapshot: inv.lnAddressSnapshot,
      status: "pending",
      attemptCount: nextAttemptNumber,
      lastAttemptAt: new Date(),
    });

    const payRes = await payInvoiceWithTimeout(nwc, inv.invoice, 45000);
    if (!payRes.ok) {
      failed += 1;
      logError(payRes.error, {
        message: "Payout payInvoice failed",
        scope: input.scope,
        contestId: input.contestId ?? null,
        giveawayId: input.giveawayId ?? null,
        winnerPubkey: w.winnerPubkeyHex,
      });
      await updatePayoutAttemptByIdempotencyKey(attemptKey, {
        status: "failed",
        errorCode: "wallet_error",
        errorMessage: payRes.error.message,
        finishedAt: new Date(),
      });
      await updatePayoutItem(item.id, {
        status: "failed",
        errorCode: "wallet_error",
        errorMessage: payRes.error.message,
      });
      continue;
    }

    paid += 1;
    await updatePayoutAttemptByIdempotencyKey(attemptKey, {
      status: "succeeded",
      walletResponseJson: payRes.walletResponse ?? null,
      finishedAt: new Date(),
    });
    await updatePayoutItem(item.id, {
      status: "paid",
      paymentPreimage: payRes.preimage ?? null,
      errorCode: null,
      errorMessage: null,
    });
  }

  const totalItems = input.winners.length;
  const finalStatus =
    paid > 0 && failed === 0 && claimNeeded === 0
      ? "complete"
      : paid > 0
        ? "partial"
        : failed > 0
          ? "failed"
          : "partial";

  await updatePayoutRun(run.id, {
    status: finalStatus,
    completedAt: new Date(),
    totalItems,
    totalSats: input.winners.reduce(
      (acc, w) => acc + Math.max(0, Math.floor(w.amountSats)),
      0
    ),
    metadataJson: { paid, failed, claimNeeded, skipped },
  });

  return {
    runId: run.id,
    walletMode: "nwc_creator",
    eligible: true,
    totals: { items: totalItems, paid, failed, claimNeeded, skipped },
  };
}
