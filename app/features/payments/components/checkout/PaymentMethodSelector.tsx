import { Bitcoin, Wallet, Zap } from "lucide-react";

import type { CheckoutPaymentMethodId } from "~/features/payments/checkout/checkout-method-config";
import { isRecommendedMethod } from "~/features/payments/checkout/checkout-method-config";
import { cn } from "~/lib/utils";

const COPY: Record<
  CheckoutPaymentMethodId,
  { label: string; supporting: string }
> = {
  auto_renew: {
    label: "Auto-renew with wallet",
    supporting: "Connect once, renew until you cancel",
  },
  lightning_one_time: {
    label: "One-time Lightning",
    supporting: "Pay manually each term",
  },
  btc_onchain: {
    label: "Bitcoin on-chain",
    supporting: "Annual on-chain via BTCPay",
  },
};

const ICON: Record<CheckoutPaymentMethodId, typeof Wallet> = {
  auto_renew: Wallet,
  lightning_one_time: Zap,
  btc_onchain: Bitcoin,
};

interface PaymentMethodSelectorProps {
  methods: CheckoutPaymentMethodId[];
  value: CheckoutPaymentMethodId;
  onChange: (method: CheckoutPaymentMethodId) => void;
  disabled?: boolean;
}

export function PaymentMethodSelector({
  methods,
  value,
  onChange,
  disabled,
}: PaymentMethodSelectorProps): React.ReactElement {
  return (
    <div
      className="stack-tight sm:flex-row sm:flex-wrap"
      role="tablist"
      aria-label="Payment method"
    >
      {methods.map((id) => {
        const Icon = ICON[id];
        const selected = value === id;
        const c = COPY[id];
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={selected}
            disabled={disabled}
            onClick={() => onChange(id)}
            className={cn(
              "focus-ring border-border motion-fast relative flex flex-1 flex-col items-start rounded-lg border px-4 py-3 text-left text-sm disabled:opacity-50",
              selected
                ? "border-selection-border bg-surface-selected ring-selection-border/35 shadow-1 ring-2"
                : "bg-surface hover:bg-surface-hover/40"
            )}
          >
            {isRecommendedMethod(id) ? (
              <span className="bg-selection-wash text-selection-foreground mb-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                Recommended
              </span>
            ) : null}
            <span className="cluster font-semibold">
              <Icon
                className={cn(
                  "h-5 w-5 shrink-0",
                  selected
                    ? "text-surface-selected-foreground"
                    : "text-text-secondary"
                )}
              />
              {c.label}
            </span>
            <span className="text-text-secondary mt-0.5 text-xs">
              {c.supporting}
            </span>
          </button>
        );
      })}
    </div>
  );
}
