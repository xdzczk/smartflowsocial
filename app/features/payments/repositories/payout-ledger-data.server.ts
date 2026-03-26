import type {
  PayoutAttemptStatus,
  PayoutItemStatus,
  PayoutRunStatus,
} from "@prisma/client";

import { prisma, type AppPrismaTransactionClient } from "~/lib/prisma.server";

export function withPayoutLedgerTransaction<T>(
  fn: (tx: AppPrismaTransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(fn);
}

export function findPayoutRunByIdempotencyKey(idempotencyKey: string) {
  return prisma.payoutRun.findUnique({ where: { idempotencyKey } });
}

export async function findOrCreatePayoutRunByIdempotencyKey(
  tx: AppPrismaTransactionClient,
  args: {
    idempotencyKey: string;
    scope: "CONTEST" | "GIVEAWAY";
    userId: string;
    walletMode: "manual" | "nwc_creator";
    trigger: "manual_trigger" | "autorun";
    contestId?: string | null;
    giveawayId?: string | null;
    spendCapSats?: number | null;
    totalItems?: number | null;
    totalSats?: number | null;
  }
) {
  const existing = await tx.payoutRun.findUnique({
    where: { idempotencyKey: args.idempotencyKey },
  });
  if (existing) return existing;
  return tx.payoutRun.create({
    data: {
      idempotencyKey: args.idempotencyKey,
      scope: args.scope,
      userId: args.userId,
      walletMode: args.walletMode,
      trigger: args.trigger,
      contestId: args.contestId ?? null,
      giveawayId: args.giveawayId ?? null,
      spendCapSats: args.spendCapSats ?? null,
      totalItems: args.totalItems ?? null,
      totalSats: args.totalSats ?? null,
    },
  });
}

export function updatePayoutRun(
  runId: string,
  data: {
    status?: PayoutRunStatus;
    startedAt?: Date | null;
    completedAt?: Date | null;
    eligibilityErrorCode?: string | null;
    eligibilityErrorMessage?: string | null;
    totalItems?: number | null;
    totalSats?: number | null;
    metadataJson?: unknown;
  },
  /** Use inside `withPayoutLedgerTransaction` so updates see uncommitted rows. */
  tx?: AppPrismaTransactionClient
) {
  const db = tx ?? prisma;
  return db.payoutRun.update({
    where: { id: runId },
    data: {
      ...(data.status ? { status: data.status } : {}),
      ...(data.startedAt !== undefined ? { startedAt: data.startedAt } : {}),
      ...(data.completedAt !== undefined
        ? { completedAt: data.completedAt }
        : {}),
      ...(data.eligibilityErrorCode !== undefined
        ? { eligibilityErrorCode: data.eligibilityErrorCode }
        : {}),
      ...(data.eligibilityErrorMessage !== undefined
        ? { eligibilityErrorMessage: data.eligibilityErrorMessage }
        : {}),
      ...(data.totalItems !== undefined ? { totalItems: data.totalItems } : {}),
      ...(data.totalSats !== undefined ? { totalSats: data.totalSats } : {}),
      ...(data.metadataJson !== undefined
        ? { metadataJson: data.metadataJson as never }
        : {}),
    },
  });
}

export function upsertPayoutItemByRunAndWinner(args: {
  runId: string;
  winnerPubkey: string;
  amountSats: number;
  idempotencyKey: string;
}) {
  return prisma.payoutItem.upsert({
    where: {
      runId_winnerPubkey: {
        runId: args.runId,
        winnerPubkey: args.winnerPubkey,
      },
    },
    update: {
      amountSats: args.amountSats,
      idempotencyKey: args.idempotencyKey,
    },
    create: {
      runId: args.runId,
      winnerPubkey: args.winnerPubkey,
      amountSats: args.amountSats,
      idempotencyKey: args.idempotencyKey,
      status: "pending",
    },
  });
}

export function updatePayoutItem(
  itemId: string,
  data: {
    status?: PayoutItemStatus;
    lnAddressSnapshot?: string | null;
    destinationSnapshot?: unknown;
    invoice?: string | null;
    invoiceExpiresAt?: Date | null;
    walletRequestId?: string | null;
    paymentPreimage?: string | null;
    paymentHash?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    attemptCount?: number;
    lastAttemptAt?: Date | null;
  }
) {
  return prisma.payoutItem.update({
    where: { id: itemId },
    data: {
      ...(data.status ? { status: data.status } : {}),
      ...(data.lnAddressSnapshot !== undefined
        ? { lnAddressSnapshot: data.lnAddressSnapshot }
        : {}),
      ...(data.destinationSnapshot !== undefined
        ? { destinationSnapshot: data.destinationSnapshot as never }
        : {}),
      ...(data.invoice !== undefined ? { invoice: data.invoice } : {}),
      ...(data.invoiceExpiresAt !== undefined
        ? { invoiceExpiresAt: data.invoiceExpiresAt }
        : {}),
      ...(data.walletRequestId !== undefined
        ? { walletRequestId: data.walletRequestId }
        : {}),
      ...(data.paymentPreimage !== undefined
        ? { paymentPreimage: data.paymentPreimage }
        : {}),
      ...(data.paymentHash !== undefined
        ? { paymentHash: data.paymentHash }
        : {}),
      ...(data.errorCode !== undefined ? { errorCode: data.errorCode } : {}),
      ...(data.errorMessage !== undefined
        ? { errorMessage: data.errorMessage }
        : {}),
      ...(data.attemptCount !== undefined
        ? { attemptCount: data.attemptCount }
        : {}),
      ...(data.lastAttemptAt !== undefined
        ? { lastAttemptAt: data.lastAttemptAt }
        : {}),
    },
  });
}

export function createPayoutAttempt(args: {
  runId: string;
  itemId: string;
  attemptNumber: number;
  idempotencyKey: string;
}) {
  return prisma.payoutAttempt.create({
    data: {
      runId: args.runId,
      itemId: args.itemId,
      attemptNumber: args.attemptNumber,
      idempotencyKey: args.idempotencyKey,
      status: "started",
      startedAt: new Date(),
    },
  });
}

export function updatePayoutAttemptByIdempotencyKey(
  idempotencyKey: string,
  data: {
    status: PayoutAttemptStatus;
    walletResponseJson?: unknown;
    errorCode?: string | null;
    errorMessage?: string | null;
    finishedAt?: Date | null;
  }
) {
  return prisma.payoutAttempt.update({
    where: { idempotencyKey },
    data: {
      status: data.status,
      ...(data.walletResponseJson !== undefined
        ? { walletResponseJson: data.walletResponseJson as never }
        : {}),
      ...(data.errorCode !== undefined ? { errorCode: data.errorCode } : {}),
      ...(data.errorMessage !== undefined
        ? { errorMessage: data.errorMessage }
        : {}),
      ...(data.finishedAt !== undefined ? { finishedAt: data.finishedAt } : {}),
    },
  });
}

export function listPayoutItemsByRunId(runId: string) {
  return prisma.payoutItem.findMany({ where: { runId } });
}
