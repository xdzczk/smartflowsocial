/**
 * Subscription checkout: single-surface guided flow (method selector + detail panel + summary).
 */

import { Loader2 } from "lucide-react";
import { useRef, useState } from "react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { trackCheckoutEvent } from "~/features/payments/checkout/checkout-analytics.client";
import type { CheckoutPaymentMethodId } from "~/features/payments/checkout/checkout-method-config";
import {
  defaultCheckoutPaymentMethod,
  getAvailableCheckoutMethods,
} from "~/features/payments/checkout/checkout-method-config";
import type { PlanCheckoutPricing } from "~/features/payments/checkout/checkout-pricing";
import {
  canSubmitAutoRenewCheckout,
  isLikelyNwcConnectionString,
} from "~/features/payments/checkout/nwc-string-guard";
import { CheckoutSummary } from "~/features/payments/components/checkout/CheckoutSummary";
import { PaymentMethodSelector } from "~/features/payments/components/checkout/PaymentMethodSelector";
import { TrustStrip } from "~/features/payments/components/checkout/TrustStrip";

export interface SubscriptionCheckoutPlan {
  id: string;
  name: string;
  price: number;
  period: string;
  checkoutPricing: PlanCheckoutPricing;
}

interface SubscriptionCheckoutModalProps {
  isOpen: boolean;
  plan: SubscriptionCheckoutPlan | null;
  isSubmitting: boolean;
  billingCadence: "monthly" | "yearly";
  manualDurations: number[];
  selectedManualDurationMonths: number;
  onSelectedManualDurationMonthsChange: (months: number) => void;
  nwcEnabled: boolean;
  maskedNwcString?: string;
  nwcString: string;
  onNwcStringChange: (value: string) => void;
  onSelectManual: () => void;
  onSelectAutoRenew: () => void;
  btcpayYearlyOnChainEnabled?: boolean;
  onSelectBtcOnchain?: () => void;
  onClose: () => void;
  paymentMethod: CheckoutPaymentMethodId;
  onPaymentMethodChange: (method: CheckoutPaymentMethodId) => void;
}

export { defaultCheckoutPaymentMethod };

export function SubscriptionCheckoutModal({
  isOpen,
  plan,
  isSubmitting,
  billingCadence,
  manualDurations,
  selectedManualDurationMonths,
  onSelectedManualDurationMonthsChange,
  nwcEnabled,
  maskedNwcString,
  nwcString,
  onNwcStringChange,
  onSelectManual,
  onSelectAutoRenew,
  btcpayYearlyOnChainEnabled,
  onSelectBtcOnchain,
  onClose,
  paymentMethod,
  onPaymentMethodChange,
}: SubscriptionCheckoutModalProps) {
  const [nwcTouched, setNwcTouched] = useState(false);
  const nwcStartedRef = useRef(false);
  const nwcValidEmittedRef = useRef(false);

  if (!isOpen || !plan) return null;

  const available = getAvailableCheckoutMethods({
    planId: plan.id,
    billingCadence,
    btcpayYearlyOnChainEnabled: Boolean(btcpayYearlyOnChainEnabled),
  });

  const effectiveMethod = available.includes(paymentMethod)
    ? paymentMethod
    : (available[0] ?? defaultCheckoutPaymentMethod());

  const showManualDurationPicker = billingCadence === "monthly";
  const accessMonths =
    billingCadence === "yearly" ? 12 : selectedManualDurationMonths;

  const autoRenewOk = canSubmitAutoRenewCheckout({ nwcEnabled, nwcString });
  const showNwcError =
    nwcTouched &&
    !nwcEnabled &&
    nwcString.trim().length > 0 &&
    !isLikelyNwcConnectionString(nwcString);

  const handleNwcChange = (v: string) => {
    if (!nwcStartedRef.current && v.trim().length > 0) {
      nwcStartedRef.current = true;
      trackCheckoutEvent("nwc_input_started", {
        source: "plans_page",
        plan: plan.id,
      });
    }
    const valid = isLikelyNwcConnectionString(v);
    if (valid && !nwcValidEmittedRef.current) {
      nwcValidEmittedRef.current = true;
      trackCheckoutEvent("nwc_input_valid", {
        source: "plans_page",
        plan: plan.id,
      });
    }
    if (!valid) {
      nwcValidEmittedRef.current = false;
    }
    onNwcStringChange(v);
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setNwcTouched(false);
          nwcStartedRef.current = false;
          nwcValidEmittedRef.current = false;
          onClose();
        }
      }}
    >
      <DialogContent
        hideCloseButton
        className="bg-background max-h-[90dvh] max-w-[920px] gap-0 overflow-y-auto p-0 sm:max-w-[920px]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="p-6 pb-0">
          <div className="mb-4 flex items-start justify-between gap-4">
            <DialogHeader className="space-y-1.5 text-left">
              <DialogTitle className="text-xl font-semibold">
                Complete checkout
              </DialogTitle>
              <p className="text-foreground text-base font-semibold">
                {plan.name} · {plan.price === 0 ? "Free" : `$${plan.price}`}{" "}
                {plan.period ? plan.period : ""}
              </p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Pick a payment path. Access activates after your payment
                confirms.
              </p>
            </DialogHeader>
            <DialogClose asChild>
              <button
                type="button"
                className="border-border bg-muted text-muted-foreground hover:bg-muted/80 focus:ring-ring shrink-0 rounded-lg border px-3 py-2 text-sm font-medium focus:ring-2 focus:outline-none"
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
            {effectiveMethod === "auto_renew" ? (
              <section aria-labelledby="panel-auto-renew">
                <h4
                  id="panel-auto-renew"
                  className="text-foreground mb-1 text-base font-semibold"
                >
                  Auto-renew with wallet
                  <span className="bg-primary/15 text-primary ml-2 rounded-full px-2 py-0.5 text-xs font-medium">
                    Recommended
                  </span>
                </h4>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Connect Nostr Wallet Connect once, pay the first invoice, then
                  renew on cadence until you cancel.
                </p>
                <p className="text-muted-foreground mt-2 text-xs">
                  Best for uninterrupted access without manual renewals.
                </p>
                <div className="mt-4">
                  <label
                    htmlFor="checkout-nwc-string"
                    className="text-muted-foreground mb-1 block text-xs font-medium"
                  >
                    NWC connection string
                  </label>
                  <textarea
                    id="checkout-nwc-string"
                    value={nwcString}
                    onChange={(e) => handleNwcChange(e.target.value)}
                    onBlur={() => setNwcTouched(true)}
                    placeholder="nostr+walletconnect://…"
                    autoComplete="off"
                    className="border-border bg-muted text-foreground focus:border-primary focus:ring-ring min-h-[84px] w-full rounded-lg border px-3 py-2 text-xs focus:ring-1 focus:outline-none"
                  />
                  {nwcEnabled && maskedNwcString ? (
                    <p className="text-muted-foreground mt-1 text-xs">
                      Leave empty to bill the saved wallet ({maskedNwcString})
                    </p>
                  ) : null}
                  {showNwcError ? (
                    <p className="text-destructive mt-1 text-xs" role="alert">
                      Enter a valid Nostr Wallet Connect URL
                      (nostr+walletconnect://…).
                    </p>
                  ) : (
                    <p className="text-muted-foreground mt-1 text-xs">
                      We request payments through your wallet—you approve each
                      charge. We never custody funds.
                    </p>
                  )}
                </div>
              </section>
            ) : null}

            {effectiveMethod === "lightning_one_time" ? (
              <section aria-labelledby="panel-ln">
                <h4
                  id="panel-ln"
                  className="text-foreground mb-1 text-base font-semibold"
                >
                  One-time Lightning payment
                </h4>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Pay each invoice manually. Access runs for the term you pay
                  for; nothing renews unless you come back and pay again.
                </p>
                <p className="text-muted-foreground mt-2 text-xs">
                  No NWC required—scan and pay.
                </p>
                {showManualDurationPicker ? (
                  <div className="mt-4">
                    <label
                      htmlFor="checkout-manual-duration"
                      className="text-muted-foreground mb-1 block text-xs font-medium"
                    >
                      Access period
                    </label>
                    <select
                      id="checkout-manual-duration"
                      value={selectedManualDurationMonths}
                      onChange={(e) =>
                        onSelectedManualDurationMonthsChange(
                          Number(e.target.value)
                        )
                      }
                      disabled={isSubmitting}
                      className="border-border bg-muted text-foreground focus:border-primary focus:ring-ring w-full max-w-md rounded-lg border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
                    >
                      {manualDurations.map((months) => (
                        <option key={months} value={months}>
                          {months === 1
                            ? "1 month"
                            : months === 3
                              ? "3 months"
                              : months === 6
                                ? "6 months"
                                : `${months} months`}
                        </option>
                      ))}
                    </select>
                    <p className="text-muted-foreground mt-2 text-xs">
                      Prefer auto-renew later? Pay once now, connect NWC in
                      Settings when you are ready.
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground mt-4 text-sm">
                    Yearly Lightning is one invoice for 12 months upfront.
                  </p>
                )}
              </section>
            ) : null}

            {effectiveMethod === "btc_onchain" &&
            billingCadence === "yearly" &&
            typeof onSelectBtcOnchain === "function" ? (
              <section aria-labelledby="panel-btc">
                <h4
                  id="panel-btc"
                  className="text-foreground mb-1 text-base font-semibold"
                >
                  Bitcoin on-chain
                </h4>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Pay from any BTC wallet through BTCPay. Access turns on after
                  the required confirmations land.
                </p>
                <p className="text-muted-foreground mt-2 text-xs">
                  Suited to yearly or larger amounts. Yearly billing only.
                </p>
              </section>
            ) : null}
          </div>

          <CheckoutSummary
            planLabel={plan.name}
            billingCadence={billingCadence}
            method={effectiveMethod}
            accessDurationMonths={accessMonths}
            pricing={plan.checkoutPricing}
          />

          <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <DialogClose asChild>
              <button
                type="button"
                className="border-border bg-background text-muted-foreground hover:bg-muted/60 focus:ring-ring order-2 rounded-lg border px-4 py-2.5 text-sm font-medium focus:ring-2 focus:outline-none sm:order-1"
              >
                Cancel
              </button>
            </DialogClose>
            <div className="order-1 flex w-full flex-col gap-2 sm:order-2 sm:max-w-md sm:flex-1">
              {effectiveMethod === "auto_renew" ? (
                <button
                  type="button"
                  onClick={onSelectAutoRenew}
                  disabled={isSubmitting || !autoRenewOk}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-ring w-full rounded-lg px-4 py-3 text-sm font-medium transition-colors focus:ring-2 focus:outline-none disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Starting…
                    </span>
                  ) : (
                    "Start auto-renewing plan"
                  )}
                </button>
              ) : null}
              {effectiveMethod === "lightning_one_time" ? (
                <button
                  type="button"
                  onClick={onSelectManual}
                  disabled={isSubmitting}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-ring w-full rounded-lg px-4 py-3 text-sm font-medium transition-colors focus:ring-2 focus:outline-none disabled:opacity-50"
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
                  className="bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-ring w-full rounded-lg px-4 py-3 text-sm font-medium transition-colors focus:ring-2 focus:outline-none disabled:opacity-50"
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
