/**
 * Admin: list referrals and earnings with pagination/filters, CSV export, retry failed.
 */

import { env } from "~/lib/env.server";

import { ReferralEarningStatus } from "./data/referral-prisma-types.server";
import {
  countEarningsAdmin,
  countReferralsAdmin,
  findEarningByIdForRetry,
  findEarningsAdmin,
  findReferralsAdmin,
  updateEarningToPendingRetry,
} from "./repositories/referral-data.server";

const PAGE_SIZE = 50;

/** Trim, lowercase, strip zero-width / BOM (copy/paste). Bech32 npubs are compared case-insensitively. */
function normalizeNpubForCompare(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "");
}

function getAdminNpubs(): string[] {
  const raw = env.ADMIN_NPUBS;
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => normalizeNpubForCompare(s))
    .filter(Boolean);
}

export function isReferralAdmin(npub: string): boolean {
  const admins = getAdminNpubs();
  if (admins.length === 0) return false;
  const key = normalizeNpubForCompare(npub);
  return admins.includes(key);
}

export async function getReferralsAdmin(options: {
  referrerNpub?: string;
  referredNpub?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
}) {
  const page = Math.max(1, options.page ?? 1);
  const where: {
    referrerNpub?: { contains: string; mode: "insensitive" };
    referredNpub?: { contains: string; mode: "insensitive" };
    createdAt?: { gte?: Date; lte?: Date };
  } = {};

  if (options.referrerNpub?.trim()) {
    where.referrerNpub = {
      contains: options.referrerNpub.trim(),
      mode: "insensitive",
    };
  }
  if (options.referredNpub?.trim()) {
    where.referredNpub = {
      contains: options.referredNpub.trim(),
      mode: "insensitive",
    };
  }
  if (options.dateFrom || options.dateTo) {
    where.createdAt = {};
    if (options.dateFrom) {
      where.createdAt.gte = new Date(options.dateFrom);
    }
    if (options.dateTo) {
      where.createdAt.lte = new Date(options.dateTo);
    }
  }

  const [rows, total] = await Promise.all([
    findReferralsAdmin(where, (page - 1) * PAGE_SIZE, PAGE_SIZE),
    countReferralsAdmin(where),
  ]);

  return {
    referrals: rows,
    total,
    page,
    pageSize: PAGE_SIZE,
  };
}

export async function getEarningsAdmin(options: {
  referrerNpub?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
}) {
  const page = Math.max(1, options.page ?? 1);
  const where: {
    referrerNpub?: { contains: string; mode: "insensitive" };
    status?: ReferralEarningStatus;
    createdAt?: { gte?: Date; lte?: Date };
  } = {};

  if (options.referrerNpub?.trim()) {
    where.referrerNpub = {
      contains: options.referrerNpub.trim(),
      mode: "insensitive",
    };
  }
  if (
    options.status === "pending" ||
    options.status === "paid" ||
    options.status === "failed"
  ) {
    where.status = options.status as ReferralEarningStatus;
  }
  if (options.dateFrom || options.dateTo) {
    where.createdAt = {};
    if (options.dateFrom) {
      where.createdAt.gte = new Date(options.dateFrom);
    }
    if (options.dateTo) {
      where.createdAt.lte = new Date(options.dateTo);
    }
  }

  const [rows, total] = await Promise.all([
    findEarningsAdmin(where, (page - 1) * PAGE_SIZE, PAGE_SIZE),
    countEarningsAdmin(where),
  ]);

  return {
    earnings: rows,
    total,
    page,
    pageSize: PAGE_SIZE,
  };
}

export function referralsToCsv(
  referrals: Array<{
    referrerNpub: string;
    referredNpub: string;
    createdAt: Date;
  }>
): string {
  const header = "referrer_npub,referred_npub,created_at";
  const rows = referrals.map((r) =>
    [r.referrerNpub, r.referredNpub, r.createdAt.toISOString()]
      .map((c) => `"${String(c).replace(/"/g, '""')}"`)
      .join(",")
  );
  return [header, ...rows].join("\n");
}

export function earningsToCsv(
  earnings: Array<{
    referrerNpub: string;
    referredNpub: string;
    paymentId: string;
    amountPaidSats: number;
    commissionSats: number;
    status: string;
    createdAt: Date;
    paidAt: Date | null;
  }>
): string {
  const header =
    "referrer_npub,referred_npub,payment_id,amount_paid_sats,commission_sats,status,created_at,paid_at";
  const rows = earnings.map((e) =>
    [
      e.referrerNpub,
      e.referredNpub,
      e.paymentId,
      e.amountPaidSats,
      e.commissionSats,
      e.status,
      e.createdAt.toISOString(),
      e.paidAt?.toISOString() ?? "",
    ]
      .map((c) => `"${String(c).replace(/"/g, '""')}"`)
      .join(",")
  );
  return [header, ...rows].join("\n");
}

export async function retryFailedPayout(
  earningId: string
): Promise<{ success: boolean; error?: string }> {
  const e = await findEarningByIdForRetry(earningId);
  if (!e) return { success: false, error: "Earning not found" };
  if (e.status !== ReferralEarningStatus.FAILED) {
    return { success: false, error: "Only failed earnings can be retried" };
  }
  await updateEarningToPendingRetry(earningId);
  return { success: true };
}
