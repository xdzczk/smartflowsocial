import { Form, Link, useFetcher } from "@remix-run/react";
import { format } from "date-fns";
import {
  Crown,
  Calendar,
  CreditCard,
  ArrowUpRight,
  AlertCircle,
  History,
  Receipt,
  Copy,
  Check,
} from "lucide-react";
import React from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  INLINE_ICON_SIZE_CLASS,
  SMALL_ICON_SIZE_CLASS,
} from "~/lib/icon-constants";

interface Plan {
  id: string;
  name: string;
  price: number;
  enableLifetimeAccess: boolean;
}

interface Subscription {
  id: string;
  planId: string | null;
  status: string;
  renewalMode?: string;
  billingCadence?: string;
  accessDurationMonths?: number;
  billingPaymentMethod?: string;
  renewalFailureCount?: number;
  lastRenewalAttemptAt?: Date | null;
  nextRenewalAttemptAt?: Date | null;
  gracePeriodEndsAt?: Date | null;
  startDate: Date;
  currentPeriodEnd: Date | null;
  nextPaymentDue: Date | null;
  cancelAtPeriodEnd: boolean;
  plan: Plan | null;
}

interface PaymentHistory {
  id: string;
  amount: number;
  amountUsd: number | null;
  description: string | null;
  paidAt: Date | null;
  paymentMethod: string | null;
  paymentHash: string;
  planName?: string;
  planPrice?: number;
}

interface SubscriptionSettingsProps {
  subscription: Subscription | null;
  availablePlans: Plan[];
  paymentHistory: PaymentHistory[];
  nwcEnabled: boolean;
}

/**
 * Display status for the UI: show EXPIRED when the billing period has ended
 * even if the DB still has status ACTIVE.
 */
function getDisplaySubscriptionStatus(subscription: Subscription): string {
  if (subscription.status !== "ACTIVE") {
    return subscription.status;
  }
  if (subscription.plan?.enableLifetimeAccess) {
    return "ACTIVE";
  }
  const periodEnd =
    subscription.currentPeriodEnd ?? subscription.nextPaymentDue;
  if (!periodEnd) {
    return "ACTIVE";
  }
  if (new Date(periodEnd) < new Date()) {
    return "EXPIRED";
  }
  return "ACTIVE";
}

function getStatusColor(status: string) {
  switch (status.toUpperCase()) {
    case "ACTIVE":
      return "text-success bg-success/20 dark:text-success dark:bg-success/20/20";
    case "EXPIRED":
      return "text-destructive bg-destructive/10 dark:text-destructive dark:bg-destructive/20/20";
    case "CANCELED":
      return "text-destructive bg-destructive/10 dark:text-destructive dark:bg-destructive/20/20";
    case "PAST_DUE":
      return "text-yellow-600 bg-yellow-100 dark:text-foreground dark:bg-muted";
    case "INACTIVE":
      return "text-foreground bg-muted dark:text-muted-foreground dark:bg-card/20";
    default:
      return "text-foreground bg-muted dark:text-muted-foreground dark:bg-card/20";
  }
}

function formatSubscriptionDate(date: Date | null) {
  if (!date) return "N/A";
  return format(new Date(date), "dd MMM yyyy");
}

function formatSubscriptionDateTime(date: Date | null) {
  if (!date) return "N/A";
  return format(new Date(date), "dd MMM yyyy 'at' h:mm a");
}

function formatRenewalMode(mode: string | undefined) {
  if (mode === "auto_renew") return "Auto-renew";
  if (mode === "manual") return "Manual";
  return "Manual";
}

function formatCadence(cadence: string | undefined) {
  if (cadence === "yearly") return "Yearly";
  if (cadence === "monthly") return "Monthly";
  return "Monthly";
}

function formatBillingPaymentMethod(method: string | undefined) {
  if (method === "nwc_auto_renew") return "Connected wallet (auto-renew)";
  if (method === "lightning_one_time") return "Manual Lightning invoice";
  if (method === "btc_btcpay_onchain") return "Bitcoin on-chain (BTCPay)";
  return "Manual Lightning invoice";
}

function formatSubscriptionCurrency(
  amount: number | null,
  currency: "USD" | "SATS" = "USD"
) {
  if (!amount) return "Free";
  if (currency === "SATS") {
    return `${amount.toLocaleString()} sats`;
  }
  return `$${Number(amount).toFixed(2)}`;
}

function NoPaymentHistoryMessage() {
  return (
    <div className="py-12 text-center">
      <Receipt className="text-foreground mx-auto mb-4 h-12 w-12" />
      <h3 className="mb-2 text-lg font-medium">No Payment History</h3>
      <p className="text-muted-foreground">
        Your payment history will appear here once you make your first payment.
      </p>
    </div>
  );
}

function NoSubscriptionMessage() {
  return (
    <div className="py-8 text-center">
      <Crown className="text-foreground mx-auto mb-4 h-12 w-12" />
      <h3 className="mb-2 text-lg font-medium">No Active Subscription</h3>
      <p className="text-muted-foreground mb-6">
        You don&apos;t have an active subscription. Choose a plan to unlock
        premium features.
      </p>
      <Link
        to="/plans"
        className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
      >
        View Plans
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

/* eslint-disable sonarjs/cognitive-complexity -- Refactored: helpers and subcomponents extracted; remaining complexity is from necessary conditional UI (tabs, plan options, payment history). */
export function SubscriptionSettings({
  subscription,
  availablePlans,
  paymentHistory,
  nwcEnabled,
}: SubscriptionSettingsProps) {
  const [copyToClipboard, copiedHash] = useCopyToClipboard();
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
    // Keep duration valid when cadence changes.
    if (topUpCadence === "yearly") {
      setTopUpMonths(12);
      return;
    }
    if (![1, 3, 6].includes(topUpMonths)) {
      setTopUpMonths(1);
    }
  }, [topUpCadence, topUpMonths]);

  React.useEffect(() => {
    // If NWC isn't enabled, force manual lane.
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
    // Give a moment for server-side settlement + subscription update, then reload settings data.
    const t = setTimeout(() => {
      window.location.reload();
    }, 750);
    return () => clearTimeout(t);
  }, [invoiceIsPaid]);

  return (
    <div className="bg-card rounded-lg border p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Subscription Management</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          View your current plan and manage your subscription
        </p>
      </div>

      {subscription ? (
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-1 gap-1 sm:grid-cols-2">
            <TabsTrigger
              value="overview"
              className="flex h-auto min-h-9 items-center gap-2 px-2 py-1.5 text-center leading-tight whitespace-normal"
            >
              <Crown className={INLINE_ICON_SIZE_CLASS} />
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="payment-history"
              className="flex h-auto min-h-9 items-center gap-2 px-2 py-1.5 text-center leading-tight whitespace-normal"
            >
              <History className={INLINE_ICON_SIZE_CLASS} />
              Payment History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6 space-y-6">
            {/* Current Plan */}
            <div className="bg-muted/30 rounded-lg border p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <Crown className="h-5 w-5 text-yellow-500" />
                  <div className="min-w-0">
                    <h3 className="font-medium">Current Plan</h3>
                    <p className="text-2xl font-bold">
                      {subscription.plan?.name ?? "Unknown Plan"}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(
                          getDisplaySubscriptionStatus(subscription)
                        )}`}
                      >
                        {getDisplaySubscriptionStatus(subscription)}
                      </span>
                      {subscription.plan?.enableLifetimeAccess ? (
                        <span className="bg-muted text-foreground inline-flex items-center rounded-full px-2 py-1 text-xs font-medium">
                          Lifetime Access
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
                  <p className="text-muted-foreground text-sm">
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

            {/* Subscription Details - Only show for paid plans */}
            {subscription.plan?.price && Number(subscription.plan.price) > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {/* Start Date */}
                <div className="flex items-center gap-3 rounded-lg border p-4">
                  <Calendar className="text-success h-5 w-5" />
                  <div>
                    <p className="font-medium">Subscription Started</p>
                    <p className="text-muted-foreground text-sm">
                      {formatSubscriptionDate(subscription.startDate)}
                    </p>
                  </div>
                </div>

                {/* Next Billing Date - Combined logic for current period end and next payment due */}
                {(subscription.currentPeriodEnd ??
                  subscription.nextPaymentDue) &&
                !subscription.plan.enableLifetimeAccess ? (
                  <div className="flex items-center gap-3 rounded-lg border p-4">
                    <CreditCard className="text-primary h-5 w-5" />
                    <div>
                      <p className="font-medium">Next renewal</p>
                      <p className="text-muted-foreground text-sm">
                        {formatSubscriptionDate(
                          subscription.currentPeriodEnd ??
                            subscription.nextPaymentDue
                        )}
                      </p>
                    </div>
                  </div>
                ) : null}

                {/* Payment method */}
                {!subscription.plan.enableLifetimeAccess ? (
                  <div className="flex items-center gap-3 rounded-lg border p-4">
                    <CreditCard className="text-muted-foreground h-5 w-5" />
                    <div>
                      <p className="font-medium">Billing</p>
                      <p className="text-muted-foreground text-sm">
                        {formatCadence(subscription.billingCadence)} ·{" "}
                        {formatRenewalMode(subscription.renewalMode)}
                        {typeof subscription.accessDurationMonths ===
                          "number" &&
                        subscription.billingPaymentMethod ===
                          "lightning_one_time" ? (
                          <> · {subscription.accessDurationMonths}m upfront</>
                        ) : null}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {formatBillingPaymentMethod(
                          subscription.billingPaymentMethod
                        )}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Dunning / grace surface */}
            {subscription.status === "PAST_DUE" ||
            subscription.status === "UNPAID" ? (
              <div className="dark:border-border dark:bg-muted rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="dark:text-foreground h-5 w-5 text-amber-600" />
                  <div className="space-y-1">
                    <p className="dark:text-foreground text-sm font-medium text-amber-800">
                      Renewal issue detected
                    </p>
                    {subscription.nextRenewalAttemptAt ? (
                      <p className="text-muted-foreground text-xs">
                        Next retry:{" "}
                        {formatSubscriptionDateTime(
                          subscription.nextRenewalAttemptAt
                        )}
                      </p>
                    ) : null}
                    {subscription.gracePeriodEndsAt ? (
                      <p className="text-muted-foreground text-xs">
                        Grace until:{" "}
                        {formatSubscriptionDateTime(
                          subscription.gracePeriodEndsAt
                        )}
                      </p>
                    ) : null}
                    {typeof subscription.renewalFailureCount === "number" ? (
                      <p className="text-muted-foreground text-xs">
                        Failed attempts: {subscription.renewalFailureCount}
                      </p>
                    ) : null}
                  </div>
                </div>
                <Link
                  to="/plans"
                  className="text-primary mt-2 inline-block text-sm font-medium hover:underline"
                >
                  Renew now
                </Link>
              </div>
            ) : null}

            {/* Cancellation Notice */}
            {subscription.cancelAtPeriodEnd ? (
              <div className="dark:border-border dark:bg-muted rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="dark:text-foreground h-5 w-5 text-yellow-600" />
                  <p className="dark:text-foreground text-sm font-medium text-yellow-800">
                    Your subscription is set to cancel at the end of the current
                    period
                  </p>
                </div>
              </div>
            ) : null}

            {/* Access expired notice - when period has ended */}
            {subscription.plan?.price &&
            Number(subscription.plan.price) > 0 &&
            !subscription.plan.enableLifetimeAccess &&
            getDisplaySubscriptionStatus(subscription) === "EXPIRED" ? (
              <div className="dark:border-border dark:bg-muted rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="dark:text-foreground h-5 w-5 text-amber-600" />
                  <p className="dark:text-foreground text-sm font-medium text-amber-800">
                    Your access to {subscription.plan.name} expired on{" "}
                    {formatSubscriptionDate(
                      subscription.currentPeriodEnd ??
                        subscription.nextPaymentDue
                    )}
                    . Renew or choose a plan to restore access.
                  </p>
                </div>
                <Link
                  to="/plans"
                  className="text-primary mt-2 inline-block text-sm font-medium hover:underline"
                >
                  View plans
                </Link>
              </div>
            ) : null}

            {/* Cancel at period end - only for paid, non-lifetime, active plans with period not yet ended */}
            {subscription.plan?.price &&
            Number(subscription.plan.price) > 0 &&
            !subscription.plan.enableLifetimeAccess &&
            !subscription.cancelAtPeriodEnd &&
            getDisplaySubscriptionStatus(subscription) === "ACTIVE" ? (
              <div className="border-border space-y-4 rounded-lg border p-4">
                <div>
                  <p className="text-muted-foreground mb-2 text-sm">
                    You will keep access to {subscription.plan.name} until{" "}
                    {formatSubscriptionDate(
                      subscription.currentPeriodEnd ??
                        subscription.nextPaymentDue
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
                      className="text-destructive hover:text-destructive/90 text-sm font-medium"
                    >
                      Cancel at period end
                    </button>
                  </Form>
                </div>
                {/* Downgrade at period end - switch to another plan */}
                {availablePlans.some(
                  (p) =>
                    p.id !== subscription.planId &&
                    p.id !== subscription.plan?.id
                ) ? (
                  <div className="border-border border-t pt-4">
                    <p className="text-muted-foreground mb-2 text-sm">
                      Or switch to another plan at period end:
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
                        className="border-border bg-background text-foreground rounded-md border px-3 py-1.5 text-sm"
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
                        className="border-border bg-muted text-muted-foreground hover:bg-muted/80 rounded-md border px-3 py-1.5 text-sm font-medium"
                      >
                        Switch at period end
                      </button>
                    </Form>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Top up */}
            {subscription.plan?.enableLifetimeAccess ? null : (
              <div className="border-border space-y-4 rounded-lg border p-4">
                <div>
                  <p className="font-medium">Top up</p>
                  <p className="text-muted-foreground text-sm">
                    Add time to your subscription. Your paid-through date will
                    be extended (no time lost).
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
                        className="border-border bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
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
                        className="border-border bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
                      >
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    </label>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1">
                      <span className="text-sm font-medium">
                        Upfront months
                      </span>
                      <select
                        name="accessDurationMonths"
                        value={topUpMonths}
                        onChange={(e) => setTopUpMonths(Number(e.target.value))}
                        className="border-border bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
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
                        className="border-border bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
                      >
                        {nwcEnabled ? (
                          <option value="nwc_auto_renew">
                            Pay via connected wallet (NWC)
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
                    className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60"
                  >
                    {topUpFetcher.state === "idle"
                      ? "Create top-up"
                      : "Working..."}
                  </button>
                </topUpFetcher.Form>

                {topUpFetcher.data?.error ? (
                  <div className="text-destructive text-sm">
                    {topUpFetcher.data.error}
                  </div>
                ) : null}

                {topUpFetcher.data?.message ? (
                  <div className="text-sm">{topUpFetcher.data.message}</div>
                ) : null}

                {topUpFetcher.data &&
                topUpFetcher.data.invoice &&
                topUpFetcher.data.paymentId ? (
                  <div className="bg-muted/30 space-y-2 rounded-lg border p-3">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          Invoice for {topUpFetcher.data.planName ?? "top-up"}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {typeof topUpFetcher.data.amountUsd === "number"
                            ? `$${topUpFetcher.data.amountUsd.toFixed(2)}`
                            : null}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          const invoice = topUpFetcher.data?.invoice;
                          const paymentId = topUpFetcher.data?.paymentId;
                          if (!invoice || !paymentId) return;
                          void copyToClipboard(invoice, paymentId);
                        }}
                        className="border-border bg-background hover:bg-muted inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
                      >
                        <Copy className={SMALL_ICON_SIZE_CLASS} />
                        Copy invoice
                      </button>
                    </div>
                    <p className="text-muted-foreground font-mono text-xs break-all">
                      {topUpFetcher.data.invoice}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Status:{" "}
                      {invoiceIsPaid
                        ? "Paid"
                        : (pollFetcher.data?.status ?? "Awaiting payment")}
                    </p>
                  </div>
                ) : null}
              </div>
            )}

            {/* View All Plans Option */}
            <div className="text-center">
              <Link
                to="/plans"
                className="text-primary hover:text-primary/90 inline-flex items-center gap-2 text-sm"
              >
                View All Plans & Features
                <ArrowUpRight className={INLINE_ICON_SIZE_CLASS} />
              </Link>
            </div>
          </TabsContent>

          <TabsContent value="payment-history" className="mt-6">
            {paymentHistory.length > 0 ? (
              <div className="space-y-4">
                <div className="mb-4 flex items-center gap-2">
                  <Receipt className="text-muted-foreground h-5 w-5" />
                  <h3 className="font-medium">Recent Payments</h3>
                </div>
                <div className="space-y-3">
                  {paymentHistory.map((payment) => (
                    <div key={payment.id} className="rounded-lg border p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <Receipt className="text-success h-4 w-4" />
                            <p className="text-sm font-medium">
                              {payment.description ??
                                payment.planName ??
                                "Payment"}
                            </p>
                          </div>
                          <p className="text-muted-foreground mb-2 text-xs">
                            {formatSubscriptionDateTime(payment.paidAt)}
                          </p>

                          {/* Payment Hash */}
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <p className="text-muted-foreground font-mono text-xs">
                              Hash: {payment.paymentHash.slice(0, 16)}...
                              {payment.paymentHash.slice(-8)}
                            </p>
                            <button
                              onClick={() =>
                                void copyToClipboard(
                                  payment.paymentHash,
                                  payment.id
                                )
                              }
                              className="hover:bg-muted dark:hover:bg-muted inline-flex items-center justify-center rounded p-1 transition-colors"
                              title="Copy payment hash"
                            >
                              {copiedHash === payment.id ? (
                                <Check
                                  className={`text-success ${SMALL_ICON_SIZE_CLASS}`}
                                />
                              ) : (
                                <Copy
                                  className={`text-muted-foreground ${SMALL_ICON_SIZE_CLASS}`}
                                />
                              )}
                            </button>
                          </div>

                          {payment.planName ? (
                            <div className="bg-muted text-foreground inline-flex items-center rounded-full px-2 py-1 text-xs font-medium">
                              {payment.planName}
                            </div>
                          ) : null}
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="text-success font-semibold">
                            {formatSubscriptionCurrency(payment.amountUsd)}
                          </p>
                          {payment.amount > 0 ? (
                            <p className="text-muted-foreground text-xs">
                              {formatSubscriptionCurrency(
                                payment.amount,
                                "SATS"
                              )}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {paymentHistory.length >= 20 ? (
                  <div className="pt-4 text-center">
                    <p className="text-muted-foreground text-sm">
                      Showing the last 20 payments
                    </p>
                  </div>
                ) : null}
              </div>
            ) : (
              <NoPaymentHistoryMessage />
            )}
          </TabsContent>
        </Tabs>
      ) : (
        <NoSubscriptionMessage />
      )}
    </div>
  );
}
/* eslint-enable sonarjs/cognitive-complexity */
