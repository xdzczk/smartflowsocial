import { Copy, Check, Receipt } from "lucide-react";
import React from "react";

import { PreferenceSection } from "~/features/settings/components/patterns";
import { SMALL_ICON_SIZE_CLASS } from "~/lib/icon-constants";

import { formatSubscriptionDateTime } from "./subscription-settings-helpers";
import type { PaymentHistory } from "./subscription-settings-types";

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

function usePaymentHashCopy(): [
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
          component: "PaymentHistorySection",
          action: "copyToClipboard",
        });
      }
    },
    []
  );

  return [copyToClipboard, copiedHash];
}

function PaymentHistoryEmptyState() {
  return (
    <div className="border-border/60 bg-muted/20 rounded-lg border border-dashed py-10 text-center">
      <Receipt className="text-muted-foreground mx-auto mb-3 h-10 w-10" />
      <h3 className="mb-1 text-sm font-medium">No payments yet</h3>
      <p className="text-muted-foreground mx-auto max-w-md text-sm">
        Invoices, renewals, and successful subscription payments will appear
        here.
      </p>
    </div>
  );
}

export interface PaymentHistorySectionProps {
  paymentHistory: PaymentHistory[];
}

export function PaymentHistorySection({
  paymentHistory,
}: PaymentHistorySectionProps) {
  const [copyToClipboard, copiedHash] = usePaymentHashCopy();

  return (
    <PreferenceSection
      title="Payment history"
      description="Invoices, renewals, and subscription payments."
    >
      {paymentHistory.length > 0 ? (
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
                        "Renewal payment"}
                    </p>
                  </div>
                  <p className="text-muted-foreground mb-2 text-xs">
                    {formatSubscriptionDateTime(payment.paidAt)}
                  </p>

                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <p className="text-muted-foreground font-mono text-xs">
                      Hash: {payment.paymentHash.slice(0, 16)}...
                      {payment.paymentHash.slice(-8)}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        void copyToClipboard(payment.paymentHash, payment.id)
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
                      {formatSubscriptionCurrency(payment.amount, "SATS")}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
          {paymentHistory.length >= 20 ? (
            <p className="text-muted-foreground pt-2 text-center text-sm">
              Showing the last 20 payments
            </p>
          ) : null}
        </div>
      ) : (
        <PaymentHistoryEmptyState />
      )}
    </PreferenceSection>
  );
}
