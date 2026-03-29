/**
 * Subscription checkout modal (NWC, Lightning, optional yearly BTC on-chain)
 */

import { Bitcoin, Loader2, Wallet, Zap } from "lucide-react";

interface SubscriptionCheckoutModalProps {
  isOpen: boolean;
  plan: { id: string; name: string; price: number; period: string } | null;
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
  /** When set and billing is yearly, shows Bitcoin on-chain lane (requires env BTCPAY_*). */
  btcpayYearlyOnChainEnabled?: boolean;
  onSelectBtcOnchain?: () => void;
  onClose: () => void;
}

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
}: SubscriptionCheckoutModalProps) {
  if (!isOpen || !plan) return null;

  const showManualDurationPicker = billingCadence === "monthly";
  const showBtcpayLane =
    billingCadence === "yearly" &&
    plan.id !== "free" &&
    plan.price > 0 &&
    Boolean(btcpayYearlyOnChainEnabled) &&
    typeof onSelectBtcOnchain === "function";

  return (
    <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div className="dark:bg-card mx-4 max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-foreground text-xl font-semibold">Checkout</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              {plan.name} · {plan.price === 0 ? "Free" : `$${plan.price}`}{" "}
              {plan.period ? plan.period : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border-border bg-muted text-muted-foreground hover:bg-muted/80 focus:ring-ring rounded-lg border px-3 py-2 text-sm font-medium focus:ring-1 focus:outline-none"
          >
            Close
          </button>
        </div>

        <div
          className={`grid grid-cols-1 gap-4 ${showBtcpayLane ? "lg:grid-cols-3" : "md:grid-cols-2"}`}
        >
          <div className="border-border bg-card relative rounded-lg border p-4">
            <div className="bg-primary/10 text-primary absolute top-3 right-3 rounded-full px-2 py-1 text-xs font-medium">
              Recommended
            </div>
            <div className="flex items-center gap-2">
              <Wallet className="text-primary h-5 w-5" />
              <span className="text-foreground font-semibold">
                Auto-renew with wallet
              </span>
            </div>
            <p className="text-muted-foreground mt-2 text-sm">
              Connect via Nostr Wallet Connect. First payment now, then renews
              automatically. Cancel anytime.
            </p>

            <div className="mt-3">
              <label
                htmlFor="nwcString"
                className="text-muted-foreground mb-1 block text-xs font-medium"
              >
                NWC connection string
              </label>
              <textarea
                id="nwcString"
                value={nwcString}
                onChange={(e) => onNwcStringChange(e.target.value)}
                placeholder={
                  nwcEnabled
                    ? `Leave blank to use saved wallet (${maskedNwcString ?? "connected"})`
                    : "Paste nostr+walletconnect://…"
                }
                className="border-border bg-muted text-foreground focus:border-primary focus:ring-ring min-h-[84px] w-full rounded-lg border px-3 py-2 text-xs focus:ring-1 focus:outline-none"
              />
              {nwcEnabled && maskedNwcString ? (
                <div className="text-muted-foreground mt-1 text-xs">
                  Using saved wallet: {maskedNwcString}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={onSelectAutoRenew}
              disabled={isSubmitting}
              className="bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-ring mt-3 w-full rounded-lg px-4 py-3 text-sm font-medium transition-colors focus:ring-1 focus:outline-none disabled:opacity-50"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Starting subscription…
                </span>
              ) : (
                "Connect wallet and start subscription"
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={onSelectManual}
            disabled={isSubmitting}
            className="border-border bg-card hover:bg-muted/40 focus:ring-ring rounded-lg border p-4 text-left transition-colors focus:ring-1 focus:outline-none disabled:opacity-50"
          >
            <div className="flex items-center gap-2">
              <Zap className="text-muted-foreground h-5 w-5" />
              <span className="text-foreground font-semibold">
                One-time payment
              </span>
            </div>
            <p className="text-muted-foreground mt-2 text-sm">
              Pay a Lightning invoice manually. Access lasts for the selected
              period and does not renew automatically.
            </p>

            {showManualDurationPicker ? (
              <div className="mt-3">
                <label
                  htmlFor="manualDuration"
                  className="text-muted-foreground mb-1 block text-xs font-medium"
                >
                  Choose access period
                </label>
                <select
                  id="manualDuration"
                  value={selectedManualDurationMonths}
                  onChange={(e) =>
                    onSelectedManualDurationMonthsChange(Number(e.target.value))
                  }
                  disabled={isSubmitting}
                  className="border-border bg-muted text-foreground focus:border-primary focus:ring-ring w-full rounded-lg border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
                >
                  {manualDurations.map((months) => (
                    <option key={months} value={months}>
                      {months === 1
                        ? "1 month"
                        : months === 3
                          ? "3 months upfront"
                          : months === 6
                            ? "6 months upfront"
                            : `${months} months`}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="text-muted-foreground mt-3 text-xs">
                Access period: 1 year upfront
              </div>
            )}

            <div className="mt-3 flex items-center gap-2 text-sm font-medium">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Preparing invoice…</span>
                </>
              ) : (
                <span className="text-foreground">Pay with invoice</span>
              )}
            </div>
          </button>

          {showBtcpayLane ? (
            <button
              type="button"
              onClick={onSelectBtcOnchain}
              disabled={isSubmitting}
              className="border-border bg-card hover:bg-muted/40 focus:ring-ring rounded-lg border p-4 text-left transition-colors focus:ring-1 focus:outline-none disabled:opacity-50"
            >
              <div className="flex items-center gap-2">
                <Bitcoin className="text-muted-foreground h-5 w-5" />
                <span className="text-foreground font-semibold">
                  Bitcoin on-chain
                </span>
              </div>
              <p className="text-muted-foreground mt-2 text-sm">
                Pay yearly with BTC on-chain via BTCPay. You will open our
                secure checkout page; we grant access after the required
                on-chain confirmations.
              </p>
              <div className="mt-3 flex items-center gap-2 text-sm font-medium">
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Preparing checkout…</span>
                  </>
                ) : (
                  <span className="text-foreground">Continue to BTCPay</span>
                )}
              </div>
            </button>
          ) : null}
        </div>

        <div className="text-muted-foreground mt-4 text-xs">
          SmartFlow never holds your funds. Lightning payments are requested
          from your wallet; on-chain payments go through BTCPay to our store
          wallet.
        </div>
      </div>
    </div>
  );
}
