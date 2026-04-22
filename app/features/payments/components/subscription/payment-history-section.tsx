import { Copy, Check, Receipt } from "lucide-react";
import React from "react";

import { EmptyState } from "~/components/ui/empty-state";
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
    <div className="border-border/60 bg-surface-hover/20 rounded-lg border border-dashed">
      <EmptyState
        icon={<Receipt />}
        title="No payments yet"
        description="Invoices, renewals, and successful subscription payments will appear here."
      />
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
                  <div className="cluster mb-1">
                    <Receipt className="text-success h-4 w-4" />
                    <p className="text-sm font-medium">
                      {payment.description ??
                        payment.planName ??
                        "Renewal payment"}
                    </p>
                  </div>
                  <p className="text-text-secondary mb-2 text-xs">
                    {formatSubscriptionDateTime(payment.paidAt)}
                  </p>

                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <p className="text-text-secondary font-mono text-xs">
                      Hash: {payment.paymentHash.slice(0, 16)}...
                      {payment.paymentHash.slice(-8)}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        void copyToClipboard(payment.paymentHash, payment.id)
                      }
                      className="hover:bg-surface-hover dark:hover:bg-surface-hover motion-fast inline-flex items-center justify-center rounded-xs p-1"
                      title="Copy payment hash"
                    >
                      {copiedHash === payment.id ? (
                        <Check
                          className={`text-success ${SMALL_ICON_SIZE_CLASS}`}
                        />
                      ) : (
                        <Copy
                          className={`text-text-secondary ${SMALL_ICON_SIZE_CLASS}`}
                        />
                      )}
                    </button>
                  </div>

                  {payment.planName ? (
                    <div className="bg-surface-hover text-text inline-flex items-center rounded-full px-2 py-1 text-xs font-medium">
                      {payment.planName}
                    </div>
                  ) : null}
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-success font-semibold">
                    {formatSubscriptionCurrency(payment.amountUsd)}
                  </p>
                  {payment.amount > 0 ? (
                    <p className="text-text-secondary text-xs">
                      {formatSubscriptionCurrency(payment.amount, "SATS")}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
          {paymentHistory.length >= 20 ? (
            <p className="text-text-secondary pt-2 text-center text-sm">
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
