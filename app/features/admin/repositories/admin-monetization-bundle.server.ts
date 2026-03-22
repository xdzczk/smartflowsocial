/**
 * Business / monetization aggregates for admin (shared bundle).
 */

import { PaymentStatus, SubscriptionStatus } from "@prisma/client";

import { FREE_PLAN_ID } from "~/features/payments/plan-ids";
import { prisma } from "~/lib/prisma.server";

import type { RangePreset } from "../metrics/date-range";
import {
  getBoundsForPreset,
  getPreviousPeriodBounds,
} from "../metrics/date-range";
import { confidenceForCount } from "../metrics/resolve-confidence";

export interface MonetizationBundle {
  /** Stringified satoshis for JSON-safe loaders. */
  mrrSats: string;
  arrRunRateSats: string;
  activePaidSubscribers: number;
  subscriptionsStartedInRange: number;
  subscriptionsCanceledInRange: number;
  /** Paid starts minus cancellations in range (flow proxy). */
  netSubscriptionFlowInRange: number;
  planMix: Array<{ planId: string | null; count: number }>;
  arppuSatsInRange: number | null;
  referredRevenueSatsInRange: number;
  totalPaymentSatsInRange: number;
  revenueConfidence: ReturnType<typeof confidenceForCount>;
}

export async function getMonetizationBundle(
  preset: RangePreset,
  now: Date = new Date()
): Promise<MonetizationBundle> {
  const bounds = getBoundsForPreset(preset, now);
  void getPreviousPeriodBounds(bounds, now);

  const paidWhere = {
    status: SubscriptionStatus.ACTIVE,
    NOT: { planId: FREE_PLAN_ID },
  } as const;

  const [
    mrrAgg,
    activePaidSubscribers,
    startedInRange,
    canceledInRange,
    planMixRows,
    paymentSum,
    paymentCountInRange,
    referralAgg,
  ] = await Promise.all([
    prisma.subscription.aggregate({
      where: paidWhere,
      _sum: { amountSats: true },
    }),
    prisma.subscription.count({ where: paidWhere }),
    prisma.subscription.count({
      where: {
        createdAt: { gte: bounds.from, lt: bounds.to },
        NOT: { planId: FREE_PLAN_ID },
      },
    }),
    prisma.subscription.count({
      where: {
        status: SubscriptionStatus.CANCELED,
        updatedAt: { gte: bounds.from, lt: bounds.to },
        NOT: { planId: FREE_PLAN_ID },
      },
    }),
    prisma.subscription.groupBy({
      by: ["planId"],
      where: paidWhere,
      _count: { _all: true },
    }),
    prisma.payment.aggregate({
      where: {
        status: PaymentStatus.COMPLETED,
        paidAt: { gte: bounds.from, lt: bounds.to },
      },
      _sum: { amount: true },
    }),
    prisma.payment.count({
      where: {
        status: PaymentStatus.COMPLETED,
        paidAt: { gte: bounds.from, lt: bounds.to },
      },
    }),
    prisma.referralEarning.aggregate({
      where: {
        createdAt: { gte: bounds.from, lt: bounds.to },
      },
      _sum: { commissionSats: true },
    }),
  ]);

  const mrrSatsBi = mrrAgg._sum.amountSats ?? BigInt(0);
  const arrRunRateSatsBi = mrrSatsBi * BigInt(12);
  const mrrSats = mrrSatsBi.toString();
  const arrRunRateSats = arrRunRateSatsBi.toString();

  const planMix = planMixRows
    .map((r) => ({ planId: r.planId, count: r._count._all }))
    .sort((a, b) => b.count - a.count);

  const totalPaymentSatsInRange = paymentSum._sum.amount ?? 0;
  const arppuSatsInRange =
    activePaidSubscribers > 0
      ? Math.round(totalPaymentSatsInRange / activePaidSubscribers)
      : null;

  const referredRevenueSatsInRange = referralAgg._sum.commissionSats ?? 0;

  return {
    mrrSats,
    arrRunRateSats,
    activePaidSubscribers,
    subscriptionsStartedInRange: startedInRange,
    subscriptionsCanceledInRange: canceledInRange,
    netSubscriptionFlowInRange: startedInRange - canceledInRange,
    planMix,
    arppuSatsInRange,
    referredRevenueSatsInRange,
    totalPaymentSatsInRange,
    revenueConfidence: confidenceForCount(paymentCountInRange),
  };
}
