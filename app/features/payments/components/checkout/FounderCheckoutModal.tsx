/**
 * One-time lifetime (Founder) checkout - no cadence toggle, no auto-renew.
 */

import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import type { CheckoutPaymentMethodId } from "~/features/payments/checkout/checkout-method-config";
import {
  defaultCheckoutPaymentMethod,
  getAvailableCheckoutMethods,
} from "~/features/payments/checkout/checkout-method-config";
import type { PlanCheckoutPricing } from "~/features/payments/checkout/checkout-pricing";
import { CheckoutSummary } from "~/features/payments/components/checkout/CheckoutSummary";
import { PaymentMethodSelector } from "~/features/payments/components/checkout/PaymentMethodSelector";
import { TrustStrip } from "~/features/payments/components/checkout/TrustStrip";

export interface FounderCheckoutPlan {
  id: string;
  name: string;
  oneTimePriceUsd: number;
  checkoutPricing: PlanCheckoutPricing;
}

interface FounderCheckoutModalProps {
  isOpen: boolean;
  plan: FounderCheckoutPlan | null;
  isSubmitting: boolean;
  btcpayYearlyOnChainEnabled?: boolean;
  onSelectManual: () => void;
  onSelectBtcOnchain?: () => void;
  onClose: () => void;
  paymentMethod: CheckoutPaymentMethodId;
  onPaymentMethodChange: (method: CheckoutPaymentMethodId) => void;
}

export function FounderCheckoutModal({
  isOpen,
  plan,
  isSubmitting,
  btcpayYearlyOnChainEnabled,
  onSelectManual,
  onSelectBtcOnchain,
  onClose,
  paymentMethod,
  onPaymentMethodChange,
}: FounderCheckoutModalProps) {
  if (!isOpen || !plan) return null;

  const available = getAvailableCheckoutMethods({
    planId: plan.id,
    billingCadence: "yearly",
    btcpayYearlyOnChainEnabled: Boolean(btcpayYearlyOnChainEnabled),
    isLifetimePlan: true,
  });

  const effectiveMethod = available.includes(paymentMethod)
    ? paymentMethod
    : (available[0] ?? defaultCheckoutPaymentMethod());

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        hideCloseButton
        className="bg-canvas max-h-[90dvh] max-w-[920px] gap-0 overflow-y-auto p-0 sm:max-w-[920px]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="p-6 pb-0">
          <div className="mb-4 flex items-start justify-between gap-4">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="text-2xl font-semibold tracking-tight">
                Founder checkout
              </DialogTitle>
              <p className="text-link text-xs font-semibold tracking-wider uppercase">
                One-time lifetime access
              </p>
              <p className="text-text text-lg font-semibold tabular-nums">
                {plan.name} · ${plan.oneTimePriceUsd}{" "}
                <span className="text-text-secondary text-base font-normal">
                  one-time
                </span>
              </p>
              <p className="text-text-secondary max-w-lg text-sm leading-relaxed">
                Permanent Founder-tier access on this account after payment
                confirms. No subscription - pay once, no recurring bill.
              </p>
            </DialogHeader>
            <DialogClose asChild>
              <button
                type="button"
                className="focus-ring border-border bg-surface-hover text-text-secondary hover:bg-surface-hover/80 shrink-0 rounded-lg border px-3 py-2 text-sm font-medium"
              >
                Close
              </button>
            </DialogClose>
          </div>
          <TrustStrip />
        </div>

        <div className="space-y-4 px-6 py-4">
          <PaymentMethodSelector
            methods={available}
            value={effectiveMethod}
            disabled={isSubmitting}
            onChange={onPaymentMethodChange}
          />

          <div className="border-border space-y-4 border-t pt-4">
            {effectiveMethod === "lightning_one_time" ? (
              <section aria-labelledby="founder-panel-ln">
                <h4
                  id="founder-panel-ln"
                  className="text-text mb-1 text-base font-semibold"
                >
                  One-time Lightning payment
                </h4>
                <p className="text-text-secondary text-sm leading-relaxed">
                  Single Lightning invoice. When it clears, this account is
                  granted permanent Founder-tier access.
                </p>
              </section>
            ) : null}

            {effectiveMethod === "btc_onchain" &&
            typeof onSelectBtcOnchain === "function" ? (
              <section aria-labelledby="founder-panel-btc">
                <h4
                  id="founder-panel-btc"
                  className="text-text mb-1 text-base font-semibold"
                >
                  Bitcoin on-chain
                </h4>
                <p className="text-text-secondary text-sm leading-relaxed">
                  On-chain via BTCPay. Founder access activates after required
                  confirmations - same outcome as Lightning, different rail.
                </p>
              </section>
            ) : null}
          </div>

          <CheckoutSummary
            planLabel={plan.name}
            billingCadence="yearly"
            method={effectiveMethod}
            accessDurationMonths={12}
            pricing={plan.checkoutPricing}
            lifetimeOneTime
          />

          <div className="stack-tight border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <DialogClose asChild>
              <button
                type="button"
                className="focus-ring border-border bg-canvas text-text-secondary hover:bg-surface-hover/60 order-2 rounded-lg border px-4 py-2.5 text-sm font-medium sm:order-1"
              >
                Cancel
              </button>
            </DialogClose>
            <div className="order-1 flex w-full flex-col gap-2 sm:order-2 sm:max-w-md sm:flex-1">
              {effectiveMethod === "lightning_one_time" ? (
                <button
                  type="button"
                  onClick={onSelectManual}
                  disabled={isSubmitting}
                  className="focus-ring bg-action-primary text-action-primary-foreground hover:bg-action-primary/90 motion-fast w-full rounded-lg px-4 py-3 text-sm font-medium disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating invoice…
                    </span>
                  ) : (
                    "Generate Lightning invoice"
                  )}
                </button>
              ) : null}
              {effectiveMethod === "btc_onchain" &&
              typeof onSelectBtcOnchain === "function" ? (
                <button
                  type="button"
                  onClick={onSelectBtcOnchain}
                  disabled={isSubmitting}
                  className="focus-ring bg-action-primary text-action-primary-foreground hover:bg-action-primary/90 motion-fast w-full rounded-lg px-4 py-3 text-sm font-medium disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Preparing…
                    </span>
                  ) : (
                    "Continue to BTCPay"
                  )}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
