import { Link } from "@remix-run/react";
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
}

export function SubscriptionSettings({
  subscription,
  availablePlans: _availablePlans,
  paymentHistory,
}: SubscriptionSettingsProps) {
  const [copiedHash, setCopiedHash] = React.useState<string | null>(null);

  const copyToClipboard = async (text: string, hashId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedHash(hashId);
      setTimeout(() => setCopiedHash(null), 2000);
    } catch (err) {
      void (async () => {
        const { handleErrorSafely } = await import(
          "~/lib/error-handler.client"
        );
        handleErrorSafely(err, {
          component: "SubscriptionSettings",
          action: "copyToClipboard",
        });
      })();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case "ACTIVE":
        return "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/20";
      case "CANCELED":
        return "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/20";
      case "PAST_DUE":
        return "text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/20";
      case "INACTIVE":
        return "text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/20";
      default:
        return "text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/20";
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "N/A";
    return format(new Date(date), "MMM dd, yyyy");
  };

  const formatDateTime = (date: Date | null) => {
    if (!date) return "N/A";
    return format(new Date(date), "MMM dd, yyyy 'at' h:mm a");
  };

  const formatCurrency = (
    amount: number | null,
    currency: "USD" | "SATS" = "USD",
  ) => {
    if (!amount) return "Free";
    if (currency === "SATS") {
      return `${amount.toLocaleString()} sats`;
    }
    return `$${Number(amount).toFixed(2)}`;
  };

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Subscription Management</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          View your current plan and manage your subscription
        </p>
      </div>

      {subscription ? (
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Crown className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="payment-history"
              className="flex items-center gap-2"
            >
              <History className="h-4 w-4" />
              Payment History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6 space-y-6">
            {/* Current Plan */}
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Crown className="h-5 w-5 text-yellow-500" />
                  <div>
                    <h3 className="font-medium">Current Plan</h3>
                    <p className="text-2xl font-bold">
                      {subscription.plan?.name ?? "Unknown Plan"}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(
                          subscription.status,
                        )}`}
                      >
                        {subscription.status}
                      </span>
                      {subscription.plan?.enableLifetimeAccess ? (
                        <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-600 dark:bg-purple-900/20 dark:text-purple-400">
                          Lifetime Access
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold">
                    {subscription.plan?.price
                      ? `$${subscription.plan.price}`
                      : "Free"}
                  </p>
                  <p className="text-sm text-muted-foreground">
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
                  <Calendar className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium">Subscription Started</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(subscription.startDate)}
                    </p>
                  </div>
                </div>

                {/* Next Billing Date - Combined logic for current period end and next payment due */}
                {(subscription.currentPeriodEnd ??
                  subscription.nextPaymentDue) &&
                !subscription.plan?.enableLifetimeAccess ? (
                  <div className="flex items-center gap-3 rounded-lg border p-4">
                    <CreditCard className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="font-medium">Next Billing Date</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(
                          subscription.currentPeriodEnd ??
                            subscription.nextPaymentDue,
                        )}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Cancellation Notice */}
            {subscription.cancelAtPeriodEnd ? (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    Your subscription is set to cancel at the end of the current
                    period
                  </p>
                </div>
              </div>
            ) : null}

            {/* View All Plans Option */}
            <div className="text-center">
              <Link
                to="/plans"
                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                View All Plans & Features
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </TabsContent>

          <TabsContent value="payment-history" className="mt-6">
            {paymentHistory && paymentHistory.length > 0 ? (
              <div className="space-y-4">
                <div className="mb-4 flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-medium">Recent Payments</h3>
                </div>
                <div className="space-y-3">
                  {paymentHistory.map((payment) => (
                    <div key={payment.id} className="rounded-lg border p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <Receipt className="h-4 w-4 text-green-600" />
                            <p className="text-sm font-medium">
                              {payment.description ??
                                payment.planName ??
                                "Payment"}
                            </p>
                          </div>
                          <p className="mb-2 text-xs text-muted-foreground">
                            {formatDateTime(payment.paidAt)}
                          </p>

                          {/* Payment Hash */}
                          <div className="mb-2 flex items-center gap-2">
                            <p className="font-mono text-xs text-muted-foreground">
                              Hash: {payment.paymentHash.slice(0, 16)}...
                              {payment.paymentHash.slice(-8)}
                            </p>
                            <button
                              onClick={() =>
                                void copyToClipboard(
                                  payment.paymentHash,
                                  payment.id,
                                )
                              }
                              className="inline-flex items-center justify-center rounded p-1 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                              title="Copy payment hash"
                            >
                              {copiedHash === payment.id ? (
                                <Check className="h-3 w-3 text-green-600" />
                              ) : (
                                <Copy className="h-3 w-3 text-gray-500" />
                              )}
                            </button>
                          </div>

                          {payment.planName ? (
                            <div className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                              {payment.planName}
                            </div>
                          ) : null}
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-green-600">
                            {formatCurrency(payment.amountUsd)}
                          </p>
                          {payment.amount > 0 ? (
                            <p className="text-xs text-muted-foreground">
                              {formatCurrency(payment.amount, "SATS")}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {paymentHistory.length >= 20 ? (
                  <div className="pt-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      Showing the last 20 payments
                    </p>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="py-12 text-center">
                <Receipt className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                <h3 className="mb-2 text-lg font-medium">No Payment History</h3>
                <p className="text-muted-foreground">
                  Your payment history will appear here once you make your first
                  payment.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      ) : (
        /* No Subscription */
        <div className="py-8 text-center">
          <Crown className="mx-auto mb-4 h-12 w-12 text-gray-400" />
          <h3 className="mb-2 text-lg font-medium">No Active Subscription</h3>
          <p className="mb-6 text-muted-foreground">
            You don&apos;t have an active subscription. Choose a plan to unlock
            premium features.
          </p>
          <Link
            to="/plans"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            View Plans
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
