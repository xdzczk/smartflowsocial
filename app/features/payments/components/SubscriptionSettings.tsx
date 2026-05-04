import { Form, Link, useFetcher } from "@remix-run/react";
import {
  Crown,
  Calendar,
  CreditCard,
  ArrowUpRight,
  AlertCircle,
  Copy,
} from "lucide-react";
import React from "react";

import {
  INLINE_ICON_SIZE_CLASS,
  SMALL_ICON_SIZE_CLASS,
} from "~/lib/icon-constants";

import {
  billingContextPrimaryCta,
  billingModeLabel,
  formatBillingPaidUntil,
} from "./billing/billing-overview-helpers";
import {
  formatBillingPaymentMethod,
  formatCadence,
  formatRenewalMode,
  formatSubscriptionDate,
  formatSubscriptionDateTime,
  getDisplaySubscriptionStatus,
  getStatusColor,
} from "./subscription/subscription-settings-helpers";
import type {
  Subscription,
  SubscriptionSettingsProps,
} from "./subscription/subscription-settings-types";

export type {
  PaymentHistory,
  Plan,
  Subscription,
  SubscriptionSettingsProps,
} from "./subscription/subscription-settings-types";

function isPaidExtendEligible(
  subscription: Subscription,
  billingContext: SubscriptionSettingsProps["billingContext"]
): boolean {
  if (!subscription.plan || subscription.plan.enableLifetimeAccess) {
    return false;
  }
  if (billingContext) {
    return billingContext.isPaidLifecycle;
  }
  return Boolean(
    subscription.plan.price && Number(subscription.plan.price) > 0
  );
}

function isFreeOrNonPaidLifecycle(
  subscription: Subscription,
  billingContext: SubscriptionSettingsProps["billingContext"]
): boolean {
  if (!subscription.plan || subscription.plan.enableLifetimeAccess) {
    return false;
  }
  if (billingContext) {
    return !billingContext.isPaidLifecycle;
  }
  return !(subscription.plan.price && Number(subscription.plan.price) > 0);
}

function NoSubscriptionMessage() {
  return (
    <div className="py-8 text-center">
      <Crown className="text-text mx-auto mb-4 h-12 w-12" />
      <h3 className="mb-2 text-lg font-medium">You’re on the Free plan</h3>
      <p className="text-text-secondary mx-auto mb-6 max-w-md text-sm">
        Upgrade to unlock premium scheduling, templates, engagement tools, and
        more.
      </p>
      <Link
        to="/plans"
        className="bg-action-primary text-action-primary-foreground hover:bg-action-primary/90 inline-cluster rounded-lg px-4 py-2 text-sm font-medium"
      >
        View plans
        <ArrowUpRight className={INLINE_ICON_SIZE_CLASS} />
      </Link>
    </div>
  );
}

function useCopyToClipboard(): [
  (text: string, hashId: string) => Promise<void>,
  string | null,
] {
  const [copiedHash, setCopiedHash] = React.useState<string | null>(null);

  const copyToClipboard = React.useCallback(
    async (text: string, hashId: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedHash(hashId);
        setTimeout(() => setCopiedHash(null), 2000);
      } catch (err) {
        const { handleErrorSafely } =
          await import("~/lib/error-handler.client");
        handleErrorSafely(err, {
          component: "SubscriptionSettings",
          action: "copyToClipboard",
        });
      }
    },
    []
  );

  return [copyToClipboard, copiedHash];
}

function UpgradePlanSection() {
  return (
    <div className="border-border space-y-4 rounded-lg border p-4">
      <div>
        <p className="font-medium">Upgrade plan</p>
        <p className="text-text-secondary mt-1 text-sm">
          Paid plans add calendars, drafts and templates, bulk scheduling, and
          premium infrastructure - choose what fits you.
        </p>
      </div>
      <ul className="text-text-secondary list-inside list-disc space-y-1 text-sm">
        <li>Advanced scheduling and calendar</li>
        <li>Drafts, templates, and bulk tools</li>
        <li>Higher limits and premium features</li>
      </ul>
      <div className="stack-tight sm:flex-row sm:flex-wrap sm:items-center">
        <Link
          to="/plans"
          className="bg-action-primary text-action-primary-foreground hover:bg-action-primary/90 inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium"
        >
          Choose a paid plan
          <ArrowUpRight className={INLINE_ICON_SIZE_CLASS} />
        </Link>
        <Link
          to="/plans"
          className="text-link hover:text-link-hover inline-cluster text-sm font-medium"
        >
          View all plans and features
          <ArrowUpRight className={INLINE_ICON_SIZE_CLASS} />
        </Link>
      </div>
    </div>
  );
}

/* eslint-disable sonarjs/cognitive-complexity -- Plan-state matrix and extend flow */
export function SubscriptionSettings({
  subscription,
  availablePlans,
  nwcEnabled,
  billingContext,
}: SubscriptionSettingsProps) {
  const [copyToClipboard] = useCopyToClipboard();
  const topUpFetcher = useFetcher<{
    success?: boolean;
    paid?: boolean;
    message?: string;
    error?: string;
    invoice?: string;
    paymentId?: string;
    expiresAt?: string;
    planName?: string;
    planId?: string;
    amount?: number;
    amountUsd?: number;
    billingCadence?: "monthly" | "yearly";
    accessDurationMonths?: number;
    billingPaymentMethod?: "nwc_auto_renew" | "lightning_one_time";
  }>();
  const pollFetcher = useFetcher<{
    success?: boolean;
    paid?: boolean;
    status?: string;
    paidAt?: string;
    error?: string;
  }>();

  const initialPlanId = subscription?.planId ?? subscription?.plan?.id ?? "";
  const [topUpPlanId, setTopUpPlanId] = React.useState(initialPlanId);
  const [topUpCadence, setTopUpCadence] = React.useState<"monthly" | "yearly">(
    subscription?.billingCadence === "yearly" ? "yearly" : "monthly"
  );
  const [topUpMonths, setTopUpMonths] = React.useState<number>(
    topUpCadence === "yearly" ? 12 : 1
  );
  const [topUpLane, setTopUpLane] = React.useState<
    "lightning_one_time" | "nwc_auto_renew"
  >(nwcEnabled ? "nwc_auto_renew" : "lightning_one_time");

  React.useEffect(() => {
    if (topUpCadence === "yearly") {
      setTopUpMonths(12);
      return;
    }
    if (![1, 3, 6].includes(topUpMonths)) {
      setTopUpMonths(1);
    }
  }, [topUpCadence, topUpMonths]);

  React.useEffect(() => {
    if (!nwcEnabled && topUpLane === "nwc_auto_renew") {
      setTopUpLane("lightning_one_time");
    }
  }, [nwcEnabled, topUpLane]);

  const invoicePaymentId =
    topUpFetcher.data?.paymentId && topUpFetcher.data.invoice
      ? topUpFetcher.data.paymentId
      : null;
  const invoiceIsPaid =
    topUpFetcher.data?.paid === true || pollFetcher.data?.paid === true;

  React.useEffect(() => {
    if (!invoicePaymentId || invoiceIsPaid) return;

    const fd = new FormData();
    fd.set("intent", "check_payment");
    fd.set("paymentId", invoicePaymentId);

    const interval = setInterval(() => {
      pollFetcher.submit(fd, { method: "post", action: "/plans" });
    }, 2000);

    return () => clearInterval(interval);
  }, [invoicePaymentId, invoiceIsPaid, pollFetcher]);

  React.useEffect(() => {
    if (!invoiceIsPaid) return;
    const t = setTimeout(() => {
      window.location.reload();
    }, 750);
    return () => clearTimeout(t);
  }, [invoiceIsPaid]);

  const renewalContext =
    subscription &&
    billingContext &&
    !subscription.plan?.enableLifetimeAccess &&
    billingContext.isPaidLifecycle
      ? billingContext
      : null;

  const showExtendBlock =
    subscription && isPaidExtendEligible(subscription, billingContext);

  const showUpgradeBlock =
    subscription && isFreeOrNonPaidLifecycle(subscription, billingContext);

  const primaryCta = billingContext
    ? billingContextPrimaryCta(billingContext.primaryCta)
    : { label: "View plans", to: "/plans" as const };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          Billing overview
        </h2>
        <p className="text-text-secondary mt-1 text-sm leading-relaxed">
          Your plan, renewal status, and next steps.
        </p>
      </div>

      {subscription ? (
        <div className="space-y-6">
          {/* Current plan summary */}
          <div className="bg-surface-hover/30 rounded-lg border p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                {/* Decorative premium-tier gold; intentionally raw, not a status color. */}
                <Crown className="h-5 w-5 text-yellow-500" />
                <div className="min-w-0">
                  <h3 className="font-medium">Current plan</h3>
                  <p className="text-2xl font-bold">
                    {subscription.plan?.name ?? "Unknown plan"}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(
                        getDisplaySubscriptionStatus(subscription)
                      )}`}
                    >
                      {getDisplaySubscriptionStatus(subscription)}
                    </span>
                    {subscription.plan?.enableLifetimeAccess ? (
                      <span className="bg-surface-hover text-text inline-flex items-center rounded-full px-2 py-1 text-xs font-medium">
                        Lifetime access
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-lg font-semibold">
                  {subscription.plan?.price
                    ? `$${subscription.plan.price}`
                    : "Free"}
                </p>
                <p className="text-text-secondary text-sm">
                  {subscription.plan?.enableLifetimeAccess
                    ? "One-time payment"
                    : subscription.plan?.price &&
                        Number(subscription.plan.price) > 0
                      ? "per month"
                      : ""}
                </p>
              </div>
            </div>
          </div>

          {/* Merged renewal / billing context (paid recurring) */}
          {renewalContext ? (
            <div className="rounded-lg border p-4">
              <h3 className="mb-3 text-sm font-medium">Renewal and payment</h3>
              <dl className="text-text-secondary space-y-2 text-sm">
                <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
                  <dt>Renewal method</dt>
                  <dd className="text-text font-medium sm:text-right">
                    {billingModeLabel(renewalContext.commMode)}
                  </dd>
                </div>
                {formatBillingPaidUntil(renewalContext.paidUntil) ? (
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
                    <dt>Paid-through / next renewal</dt>
                    <dd className="text-text font-medium sm:text-right">
                      {formatBillingPaidUntil(renewalContext.paidUntil)}
                    </dd>
                  </div>
                ) : null}
                <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
                  <dt>Billing status</dt>
                  <dd className="text-text font-medium sm:text-right">
                    {renewalContext.uiStatus.replace(/_/g, " ")}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  to={primaryCta.to}
                  prefetch="intent"
                  className="bg-action-primary text-action-primary-foreground hover:bg-action-primary/90 inline-flex rounded-md px-3 py-1.5 text-xs font-medium"
                >
                  {primaryCta.label}
                </Link>
                <Link
                  to="/dashboard/settings?billing=payments"
                  prefetch="intent"
                  className="border-border hover:bg-surface-hover inline-flex rounded-md border px-3 py-1.5 text-xs font-medium"
                >
                  Payment method and history
                </Link>
              </div>
            </div>
          ) : null}

          {/* Subscription details  -  paid price */}
          {subscription.plan?.price && Number(subscription.plan.price) > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="cluster-loose rounded-lg border p-4">
                <Calendar className="text-success h-5 w-5" />
                <div>
                  <p className="font-medium">Subscription started</p>
                  <p className="text-text-secondary text-sm">
                    {formatSubscriptionDate(subscription.startDate)}
                  </p>
                </div>
              </div>

              {(subscription.currentPeriodEnd ?? subscription.nextPaymentDue) &&
              !subscription.plan.enableLifetimeAccess ? (
                <div className="cluster-loose rounded-lg border p-4">
                  <CreditCard className="text-link h-5 w-5" />
                  <div>
                    <p className="font-medium">Next renewal</p>
                    <p className="text-text-secondary text-sm">
                      {formatSubscriptionDate(
                        subscription.currentPeriodEnd ??
                          subscription.nextPaymentDue
                      )}
                    </p>
                  </div>
                </div>
              ) : null}

              {!subscription.plan.enableLifetimeAccess ? (
                <div className="cluster-loose rounded-lg border p-4 md:col-span-2">
                  <CreditCard className="text-text-secondary h-5 w-5" />
                  <div>
                    <p className="font-medium">Billing</p>
                    <p className="text-text-secondary text-sm">
                      {formatCadence(subscription.billingCadence)} ·{" "}
                      {formatRenewalMode(subscription.renewalMode)}
                      {typeof subscription.accessDurationMonths === "number" &&
                      subscription.billingPaymentMethod ===
                        "lightning_one_time" ? (
                        <> · {subscription.accessDurationMonths}m upfront</>
                      ) : null}
                    </p>
                    <p className="text-text-secondary text-xs">
                      {formatBillingPaymentMethod(
                        subscription.billingPaymentMethod
                      )}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {subscription.status === "PAST_DUE" ||
          subscription.status === "UNPAID" ? (
            <div className="dark:border-border dark:bg-surface-hover border-warning/40 bg-warning/12 rounded-lg border p-4">
              <div className="cluster">
                <AlertCircle className="dark:text-text text-warning h-5 w-5" />
                <div className="space-y-1">
                  <p className="dark:text-text text-warning-text text-sm font-medium">
                    Renewal issue detected
                  </p>
                  {subscription.nextRenewalAttemptAt ? (
                    <p className="text-text-secondary text-xs">
                      Next retry:{" "}
                      {formatSubscriptionDateTime(
                        subscription.nextRenewalAttemptAt
                      )}
                    </p>
                  ) : null}
                  {subscription.gracePeriodEndsAt ? (
                    <p className="text-text-secondary text-xs">
                      Grace until:{" "}
                      {formatSubscriptionDateTime(
                        subscription.gracePeriodEndsAt
                      )}
                    </p>
                  ) : null}
                  {typeof subscription.renewalFailureCount === "number" ? (
                    <p className="text-text-secondary text-xs">
                      Failed attempts: {subscription.renewalFailureCount}
                    </p>
                  ) : null}
                </div>
              </div>
              <Link
                to="/plans"
                className="text-link hover:text-link-hover mt-2 inline-block text-sm font-medium hover:underline"
              >
                Resolve renewal
              </Link>
            </div>
          ) : null}

          {subscription.cancelAtPeriodEnd ? (
            <div className="dark:border-border dark:bg-surface-hover border-warning/40 bg-warning/12 rounded-lg border p-4">
              <div className="cluster">
                <AlertCircle className="dark:text-text text-warning-text h-5 w-5" />
                <p className="dark:text-text text-warning-text text-sm font-medium">
                  Your subscription is set to cancel at the end of the current
                  period
                </p>
              </div>
            </div>
          ) : null}

          {subscription.plan?.price &&
          Number(subscription.plan.price) > 0 &&
          !subscription.plan.enableLifetimeAccess &&
          getDisplaySubscriptionStatus(subscription) === "EXPIRED" ? (
            <div className="dark:border-border dark:bg-surface-hover border-warning/40 bg-warning/12 rounded-lg border p-4">
              <div className="cluster">
                <AlertCircle className="dark:text-text text-warning h-5 w-5" />
                <p className="dark:text-text text-warning-text text-sm font-medium">
                  Your access to {subscription.plan.name} expired on{" "}
                  {formatSubscriptionDate(
                    subscription.currentPeriodEnd ?? subscription.nextPaymentDue
                  )}
                  . Choose a plan to restore access.
                </p>
              </div>
              <Link
                to="/plans"
                className="text-link hover:text-link-hover mt-2 inline-block text-sm font-medium hover:underline"
              >
                View plans
              </Link>
            </div>
          ) : null}

          {subscription.plan?.price &&
          Number(subscription.plan.price) > 0 &&
          !subscription.plan.enableLifetimeAccess &&
          !subscription.cancelAtPeriodEnd &&
          getDisplaySubscriptionStatus(subscription) === "ACTIVE" ? (
            <div className="border-border space-y-4 rounded-lg border p-4">
              <div>
                <p className="text-text-secondary mb-2 text-sm">
                  You keep access to {subscription.plan.name} until{" "}
                  {formatSubscriptionDate(
                    subscription.currentPeriodEnd ?? subscription.nextPaymentDue
                  )}
                  .
                </p>
                <Form method="post">
                  <input
                    type="hidden"
                    name="_action"
                    value="cancel_at_period_end"
                  />
                  <button
                    type="submit"
                    className="text-danger hover:text-danger/90 text-sm font-medium"
                  >
                    Cancel at period end
                  </button>
                </Form>
              </div>
              {availablePlans.some(
                (p) =>
                  p.id !== subscription.planId && p.id !== subscription.plan?.id
              ) ? (
                <div className="border-border border-t pt-4">
                  <p className="text-text-secondary mb-2 text-sm">
                    Switch to another plan at period end:
                  </p>
                  <Form
                    method="post"
                    className="flex flex-wrap items-center gap-2"
                  >
                    <input
                      type="hidden"
                      name="_action"
                      value="schedule_downgrade"
                    />
                    <select
                      name="planId"
                      className="border-border bg-canvas text-text rounded-md border px-3 py-1.5 text-sm"
                      required
                    >
                      <option value="">Choose plan</option>
                      {availablePlans
                        .filter(
                          (p) =>
                            p.id !== subscription.planId &&
                            p.id !== subscription.plan?.id
                        )
                        .map((plan) => (
                          <option key={plan.id} value={plan.id}>
                            {plan.name}
                            {plan.price === 0 ? " (Free)" : ""}
                          </option>
                        ))}
                    </select>
                    <button
                      type="submit"
                      className="border-border bg-surface-hover text-text-secondary hover:bg-surface-hover/80 rounded-md border px-3 py-1.5 text-sm font-medium"
                    >
                      Switch at period end
                    </button>
                  </Form>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Plan management: extend (paid lifecycle only) */}
          {showExtendBlock && !subscription.plan?.enableLifetimeAccess ? (
            <div className="border-border space-y-4 rounded-lg border p-4">
              <div>
                <p className="font-medium">Extend subscription</p>
                <p className="text-text-secondary text-sm">
                  Add paid time. Your paid-through date moves forward without
                  losing remaining days.
                </p>
              </div>

              <topUpFetcher.Form method="post" className="space-y-3">
                <input
                  type="hidden"
                  name="_action"
                  value="top_up_subscription"
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-sm font-medium">Plan</span>
                    <select
                      name="targetPlanId"
                      value={topUpPlanId}
                      onChange={(e) => setTopUpPlanId(e.target.value)}
                      className="border-border bg-canvas text-text w-full rounded-md border px-3 py-2 text-sm"
                      required
                    >
                      {availablePlans
                        .filter((p) => !p.enableLifetimeAccess)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                            {p.price === 0 ? " (Free)" : ""}
                          </option>
                        ))}
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className="text-sm font-medium">Cadence</span>
                    <select
                      name="billingCadence"
                      value={topUpCadence}
                      onChange={(e) =>
                        setTopUpCadence(
                          e.target.value === "yearly" ? "yearly" : "monthly"
                        )
                      }
                      className="border-border bg-canvas text-text w-full rounded-md border px-3 py-2 text-sm"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-sm font-medium">Upfront months</span>
                    <select
                      name="accessDurationMonths"
                      value={topUpMonths}
                      onChange={(e) => setTopUpMonths(Number(e.target.value))}
                      className="border-border bg-canvas text-text w-full rounded-md border px-3 py-2 text-sm"
                    >
                      {topUpCadence === "yearly" ? (
                        <option value={12}>12 months</option>
                      ) : (
                        <>
                          <option value={1}>1 month</option>
                          <option value={3}>3 months</option>
                          <option value={6}>6 months</option>
                        </>
                      )}
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className="text-sm font-medium">Payment</span>
                    <select
                      name="paymentLane"
                      value={topUpLane}
                      onChange={(e) =>
                        setTopUpLane(
                          e.target.value === "nwc_auto_renew"
                            ? "nwc_auto_renew"
                            : "lightning_one_time"
                        )
                      }
                      className="border-border bg-canvas text-text w-full rounded-md border px-3 py-2 text-sm"
                    >
                      {nwcEnabled ? (
                        <option value="nwc_auto_renew">
                          Connected wallet (NWC)
                        </option>
                      ) : null}
                      <option value="lightning_one_time">
                        Lightning invoice
                      </option>
                    </select>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={topUpFetcher.state !== "idle"}
                  className="bg-action-primary text-action-primary-foreground hover:bg-action-primary/90 inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60"
                >
                  {topUpFetcher.state === "idle"
                    ? "Continue to checkout"
                    : "Working…"}
                </button>
              </topUpFetcher.Form>

              {topUpFetcher.data?.error ? (
                <div className="text-danger text-sm">
                  {topUpFetcher.data.error}
                </div>
              ) : null}

              {topUpFetcher.data?.message ? (
                <div className="text-sm">{topUpFetcher.data.message}</div>
              ) : null}

              {topUpFetcher.data &&
              topUpFetcher.data.invoice &&
              topUpFetcher.data.paymentId ? (
                <div className="bg-surface-hover/30 space-y-2 rounded-lg border p-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        Invoice for {topUpFetcher.data.planName ?? "extension"}
                      </p>
                      <p className="text-text-secondary text-xs">
                        {typeof topUpFetcher.data.amountUsd === "number"
                          ? `$${topUpFetcher.data.amountUsd.toFixed(2)}`
                          : null}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const invoice = topUpFetcher.data?.invoice;
                        const paymentId = topUpFetcher.data?.paymentId;
                        if (!invoice || !paymentId) return;
                        void copyToClipboard(invoice, paymentId);
                      }}
                      className="border-border bg-canvas hover:bg-surface-hover inline-cluster rounded-md border px-3 py-1.5 text-sm"
                    >
                      <Copy className={SMALL_ICON_SIZE_CLASS} />
                      Copy invoice
                    </button>
                  </div>
                  <p className="text-text-secondary font-mono text-xs break-all">
                    {topUpFetcher.data.invoice}
                  </p>
                  <p className="text-text-secondary text-xs">
                    Status:{" "}
                    {invoiceIsPaid
                      ? "Paid"
                      : (pollFetcher.data?.status ?? "Awaiting payment")}
                  </p>
                </div>
              ) : null}

              <Link
                to="/plans"
                className="text-link hover:text-link-hover inline-cluster text-sm font-medium"
              >
                Compare plans and features
                <ArrowUpRight className={INLINE_ICON_SIZE_CLASS} />
              </Link>
            </div>
          ) : null}

          {showUpgradeBlock ? <UpgradePlanSection /> : null}

          {subscription.plan?.enableLifetimeAccess ? (
            <div className="text-center">
              <Link
                to="/plans"
                className="text-link hover:text-link-hover inline-cluster text-sm font-medium"
              >
                View plans and features
                <ArrowUpRight className={INLINE_ICON_SIZE_CLASS} />
              </Link>
            </div>
          ) : null}
        </div>
      ) : (
        <NoSubscriptionMessage />
      )}
    </div>
  );
}
/* eslint-enable sonarjs/cognitive-complexity */
