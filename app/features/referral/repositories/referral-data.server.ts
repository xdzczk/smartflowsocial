/**
 * Referral data access. All prisma usage for referral confined here.
 */

import type { Prisma } from "@prisma/client";

import { ReferralEarningStatus } from "~/features/referral/data/referral-prisma-types.server";
import { prisma } from "~/lib/prisma.server";

export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// --- get-referred-by
export async function findReferralByReferredNpub(referredNpub: string) {
  return prisma.referral.findUnique({
    where: { referredNpub },
    select: { referrerNpub: true },
  });
}

export async function findUserNostrProfileByNpub(npub: string) {
  return prisma.user.findUnique({
    where: { npub },
    select: { nostrProfile: true },
  });
}

// --- record-referral-earning
export async function findUserNpubById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { npub: true },
  });
}

export async function findReferralByReferredNpubSelectReferrer(
  referredNpub: string
) {
  return findReferralByReferredNpub(referredNpub);
}

export async function createReferralEarning(data: {
  referrerNpub: string;
  referredNpub: string;
  paymentId: string;
  amountPaidSats: number;
  commissionSats: number;
  status: ReferralEarningStatus;
}) {
  return prisma.referralEarning.create({ data });
}

// --- referral-admin
export async function findReferralsAdmin(
  where: {
    referrerNpub?: { contains: string; mode: "insensitive" };
    referredNpub?: { contains: string; mode: "insensitive" };
    createdAt?: { gte?: Date; lte?: Date };
  },
  skip: number,
  take: number
) {
  return prisma.referral.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });
}

export async function countReferralsAdmin(where: {
  referrerNpub?: { contains: string; mode: "insensitive" };
  referredNpub?: { contains: string; mode: "insensitive" };
  createdAt?: { gte?: Date; lte?: Date };
}) {
  return prisma.referral.count({ where });
}

export async function findEarningsAdmin(
  where: {
    referrerNpub?: { contains: string; mode: "insensitive" };
    status?: ReferralEarningStatus;
    createdAt?: { gte?: Date; lte?: Date };
  },
  skip: number,
  take: number
) {
  return prisma.referralEarning.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });
}

export async function countEarningsAdmin(where: {
  referrerNpub?: { contains: string; mode: "insensitive" };
  status?: ReferralEarningStatus;
  createdAt?: { gte?: Date; lte?: Date };
}) {
  return prisma.referralEarning.count({ where });
}

export async function findEarningByIdForRetry(earningId: string) {
  return prisma.referralEarning.findUnique({
    where: { id: earningId },
    select: { id: true, status: true },
  });
}

export async function updateEarningToPendingRetry(earningId: string) {
  return prisma.referralEarning.update({
    where: { id: earningId },
    data: {
      status: "PENDING" as ReferralEarningStatus,
      payoutAttemptCount: 0,
      payoutFailureReason: null,
    },
  });
}

// --- referral-binding (transactional)
export async function bindReferralInTransaction(
  tx: Tx,
  referredNpub: string,
  referrerNpub: string
): Promise<void> {
  const existing = await tx.referral.findUnique({
    where: { referredNpub },
    select: { referredNpub: true },
  });
  if (existing) return;

  await tx.referral.create({
    data: { referrerNpub, referredNpub },
  });
}

// --- referral-payout
export async function aggregatePendingCommissionByReferrer(
  referrerNpub: string
) {
  return prisma.referralEarning.aggregate({
    where: { referrerNpub, status: ReferralEarningStatus.PENDING },
    _sum: { commissionSats: true },
  });
}

export async function countReferralEarningsPaidInRange(params: {
  from: Date;
  to: Date;
}): Promise<number> {
  return prisma.referralEarning.count({
    where: {
      status: ReferralEarningStatus.PAID,
      paidAt: { gte: params.from, lt: params.to },
    },
  });
}

export async function findPendingEarningsForPayout(referrerNpub: string) {
  return prisma.referralEarning.findMany({
    where: { referrerNpub, status: ReferralEarningStatus.PENDING },
    orderBy: { createdAt: "asc" },
    select: { id: true, commissionSats: true },
  });
}

export async function findPendingEarningsWithAttemptCount(
  referrerNpub: string
) {
  return prisma.referralEarning.findMany({
    where: { referrerNpub, status: ReferralEarningStatus.PENDING },
    orderBy: { createdAt: "asc" },
    select: { id: true, payoutAttemptCount: true, commissionSats: true },
  });
}

export async function markEarningPaid(earningId: string, paidAt: Date) {
  return prisma.referralEarning.update({
    where: { id: earningId },
    data: {
      status: "PAID" as ReferralEarningStatus,
      paidAt,
      payoutFailureReason: null,
    },
  });
}

export async function markEarningPayoutAttempt(
  earningId: string,
  data: {
    payoutAttemptCount: number;
    payoutFailureReason: string;
    status: ReferralEarningStatus;
  }
) {
  return prisma.referralEarning.update({
    where: { id: earningId },
    data,
  });
}

export async function findReferrerPayoutConfig(referrerNpub: string) {
  return prisma.referrerPayoutConfig.findUnique({
    where: { referrerNpub },
    select: { payoutDestination: true, payoutDestinationType: true },
  });
}

export async function groupByReferrerPendingSats() {
  return prisma.referralEarning.groupBy({
    by: ["referrerNpub"],
    where: { status: ReferralEarningStatus.PENDING },
    _sum: { commissionSats: true },
  });
}

// --- referral-settings
export async function aggregateEarningsByStatus(referrerNpub: string) {
  return prisma.referralEarning.groupBy({
    by: ["status"],
    where: { referrerNpub },
    _sum: { commissionSats: true },
  });
}

export async function findReferrerPayoutConfigForSettings(
  referrerNpub: string
) {
  return findReferrerPayoutConfig(referrerNpub);
}

// --- settings referral-actions (upsert payout config)
export async function upsertReferrerPayoutConfig(
  referrerNpub: string,
  data: { payoutDestination: string; payoutDestinationType: string | null }
) {
  return prisma.referrerPayoutConfig.upsert({
    where: { referrerNpub },
    create: {
      referrerNpub,
      payoutDestination: data.payoutDestination,
      payoutDestinationType: data.payoutDestinationType,
    },
    update: {
      payoutDestination: data.payoutDestination,
      payoutDestinationType: data.payoutDestinationType,
    },
  });
}

// --- referral payout audit (admin ledger)
export async function insertReferralPayoutAuditLog(input: {
  channel: "batch" | "manual";
  referrerNpub?: string | null;
  amountSats?: number | null;
  status: "success" | "failed";
  batchSummary?: unknown;
  errorMessage?: string | null;
  operatorNpub?: string | null;
}): Promise<void> {
  await prisma.referralPayoutAuditLog.create({
    data: {
      channel: input.channel,
      referrerNpub: input.referrerNpub ?? null,
      amountSats: input.amountSats ?? null,
      status: input.status,
      batchSummary:
        input.batchSummary === undefined
          ? undefined
          : (input.batchSummary as Prisma.InputJsonValue),
      errorMessage: input.errorMessage ?? null,
      operatorNpub: input.operatorNpub ?? null,
    },
  });
}

export async function listReferralPayoutAuditLogs(limit: number) {
  return prisma.referralPayoutAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 500),
  });
}
