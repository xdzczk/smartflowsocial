/**
 * Subscription update logic shared by payment commands and handlers.
 * Isolated to avoid circular dependency between commands and handlers.
 */

import { afterSubscriptionUpdated } from "~/infra/blastr/entitlement-sync.server";
import { prisma } from "~/lib/prisma.server";

function coerceUsdAmount(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof value === "bigint") return Number(value);
  return null;
}

/**
 * Updates user subscription and account status
 */
export async function updateUserSubscription(
  userId: string,
  planId: string,
  paymentId: string
): Promise<void> {
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
  });

  if (!plan) {
    throw new Error(`Plan ${planId} not found`);
  }

  let satsAmount = 0;
  let payment: {
    amount: number;
    amountUsd: unknown;
    billingCadence: "monthly" | "yearly" | null;
    accessDurationMonths: number | null;
    billingPaymentMethod:
      | "nwc_auto_renew"
      | "lightning_one_time"
      | "btc_btcpay_onchain"
      | null;
  } | null = null;

  if (paymentId && !paymentId.startsWith("free_")) {
    payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        amount: true,
        amountUsd: true,
        billingCadence: true,
        accessDurationMonths: true,
        billingPaymentMethod: true,
      },
    });
    satsAmount = payment?.amount ?? 0;
  }

  const now = new Date();
  const isLifetime = plan.enableLifetimeAccess;
  const billingCadence = payment?.billingCadence ?? "monthly";
  const accessDurationMonths =
    payment?.accessDurationMonths ?? (billingCadence === "yearly" ? 12 : 1);
  const paymentMethod = payment?.billingPaymentMethod ?? "lightning_one_time";

  const currentPeriodStart = now;
  let currentPeriodEnd: Date | null = null;
  let nextPaymentDue: Date | null = null;

  if (!isLifetime) {
    // v1.5: treat durations as months for UX; use approximate month lengths via Date month math.
    const end = new Date(now);
    end.setMonth(end.getMonth() + accessDurationMonths);
    currentPeriodEnd = end;
    nextPaymentDue = currentPeriodEnd;
  }

  await prisma.$transaction(async (tx) => {
    const subscriptionId = `sub_${userId}_${planId}_${Date.now()}`;
    const userRow = await tx.user.findUnique({
      where: { id: userId },
      select: { nwcEnabled: true, encryptedNwc: true },
    });
    const renewalMode =
      payment?.billingPaymentMethod === "btc_btcpay_onchain"
        ? "manual"
        : userRow?.nwcEnabled && userRow.encryptedNwc
          ? "auto_renew"
          : "manual";

    const subscription = await tx.subscription.upsert({
      where: { userId },
      create: {
        id: subscriptionId,
        userId,
        planId,
        status: "ACTIVE",
        renewalMode,
        billingCadence,
        accessDurationMonths,
        paymentMethod,
        renewalFailureCount: 0,
        lastRenewalAttemptAt: null,
        nextRenewalAttemptAt: null,
        gracePeriodEndsAt: null,
        currentPeriodStart,
        currentPeriodEnd,
        nextPaymentDue,
        startDate: now,
        lastPaymentDate: now,
        plan: planId,
        amountSats: BigInt(satsAmount),
        amountUsd: coerceUsdAmount(payment?.amountUsd) ?? Number(plan.price),
      },
      update: {
        planId,
        status: "ACTIVE",
        renewalMode,
        billingCadence,
        accessDurationMonths,
        paymentMethod,
        renewalFailureCount: 0,
        lastRenewalAttemptAt: null,
        nextRenewalAttemptAt: null,
        gracePeriodEndsAt: null,
        currentPeriodStart,
        currentPeriodEnd,
        nextPaymentDue,
        lastPaymentDate: now,
        plan: planId,
        amountSats: BigInt(satsAmount),
        amountUsd: coerceUsdAmount(payment?.amountUsd) ?? Number(plan.price),
        cancelAtPeriodEnd: false,
      },
      select: { id: true },
    });

    if (payment && paymentId && !paymentId.startsWith("free_")) {
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          subscriptionId: subscription.id,
        },
      });
    }

    await tx.user.update({
      where: { id: userId },
      data: {
        isEnabled: true,
      },
    });
  });

  await afterSubscriptionUpdated(userId);
}

/**
 * Extends (tops up) a user's subscription, preserving remaining time.
 *
 * Extension base is max(now, currentPeriodEnd). This prevents users from losing time
 * when topping up before their current term ends.
 */
export async function extendUserSubscriptionFromPayment(
  userId: string,
  planId: string,
  paymentId: string
): Promise<void> {
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) {
    throw new Error(`Plan ${planId} not found`);
  }

  let satsAmount = 0;
  let payment: {
    amount: number;
    amountUsd: unknown;
    billingCadence: "monthly" | "yearly" | null;
    accessDurationMonths: number | null;
    billingPaymentMethod:
      | "nwc_auto_renew"
      | "lightning_one_time"
      | "btc_btcpay_onchain"
      | null;
  } | null = null;

  if (paymentId && !paymentId.startsWith("free_")) {
    payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        amount: true,
        amountUsd: true,
        billingCadence: true,
        accessDurationMonths: true,
        billingPaymentMethod: true,
      },
    });
    satsAmount = payment?.amount ?? 0;
  }

  const now = new Date();
  const isLifetime = plan.enableLifetimeAccess;
  const billingCadence = payment?.billingCadence ?? "monthly";
  const accessDurationMonths =
    payment?.accessDurationMonths ?? (billingCadence === "yearly" ? 12 : 1);
  const paymentMethod = payment?.billingPaymentMethod ?? "lightning_one_time";

  await prisma.$transaction(async (tx) => {
    const subscriptionId = `sub_${userId}_${planId}_${Date.now()}`;

    const [userRow, existingSub] = await Promise.all([
      tx.user.findUnique({
        where: { id: userId },
        select: { nwcEnabled: true, encryptedNwc: true },
      }),
      tx.subscription.findUnique({
        where: { userId },
        select: { currentPeriodEnd: true, startDate: true },
      }),
    ]);

    const renewalMode =
      payment?.billingPaymentMethod === "btc_btcpay_onchain"
        ? "manual"
        : userRow?.nwcEnabled && userRow.encryptedNwc
          ? "auto_renew"
          : "manual";

    const base =
      existingSub?.currentPeriodEnd && existingSub.currentPeriodEnd > now
        ? existingSub.currentPeriodEnd
        : now;

    const currentPeriodStart = now;
    let currentPeriodEnd: Date | null = null;
    let nextPaymentDue: Date | null = null;

    if (!isLifetime) {
      const end = new Date(base);
      end.setMonth(end.getMonth() + accessDurationMonths);
      currentPeriodEnd = end;
      nextPaymentDue = currentPeriodEnd;
    }

    const subscription = await tx.subscription.upsert({
      where: { userId },
      create: {
        id: subscriptionId,
        userId,
        planId,
        status: "ACTIVE",
        renewalMode,
        billingCadence,
        accessDurationMonths,
        paymentMethod,
        renewalFailureCount: 0,
        lastRenewalAttemptAt: null,
        nextRenewalAttemptAt: null,
        gracePeriodEndsAt: null,
        currentPeriodStart,
        currentPeriodEnd,
        nextPaymentDue,
        startDate: existingSub?.startDate ?? now,
        lastPaymentDate: now,
        plan: planId,
        amountSats: BigInt(satsAmount),
        amountUsd: coerceUsdAmount(payment?.amountUsd) ?? Number(plan.price),
        cancelAtPeriodEnd: false,
      },
      update: {
        planId,
        status: "ACTIVE",
        renewalMode,
        billingCadence,
        accessDurationMonths,
        paymentMethod,
        renewalFailureCount: 0,
        lastRenewalAttemptAt: null,
        nextRenewalAttemptAt: null,
        gracePeriodEndsAt: null,
        currentPeriodStart,
        currentPeriodEnd,
        nextPaymentDue,
        lastPaymentDate: now,
        plan: planId,
        amountSats: BigInt(satsAmount),
        amountUsd: coerceUsdAmount(payment?.amountUsd) ?? Number(plan.price),
        cancelAtPeriodEnd: false,
      },
      select: { id: true },
    });

    if (payment && paymentId && !paymentId.startsWith("free_")) {
      await tx.payment.update({
        where: { id: paymentId },
        data: { subscriptionId: subscription.id },
      });
    }

    await tx.user.update({
      where: { id: userId },
      data: { isEnabled: true },
    });
  });

  await afterSubscriptionUpdated(userId);
}
