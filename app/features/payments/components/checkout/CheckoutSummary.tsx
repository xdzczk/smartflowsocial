import type { CheckoutPaymentMethodId } from "~/features/payments/checkout/checkout-method-config";
import {
  computeCheckoutDueUsd,
  renewalSummaryLine,
  type PlanCheckoutPricing,
} from "~/features/payments/checkout/checkout-pricing";

interface CheckoutSummaryProps {
  planLabel: string;
  billingCadence: "monthly" | "yearly";
  method: CheckoutPaymentMethodId;
  accessDurationMonths: number;
  pricing: PlanCheckoutPricing;
  /** Founder-style one-time lifetime checkout (hides recurring language). */
  lifetimeOneTime?: boolean;
}

function paymentMethodLabel(method: CheckoutPaymentMethodId): string {
  switch (method) {
    case "auto_renew":
      return "Wallet auto-renew (NWC)";
    case "lightning_one_time":
      return "Lightning invoice";
    case "btc_onchain":
      return "Bitcoin on-chain (BTCPay)";
    default:
      return "";
  }
}

function planLineLabel(
  planLabel: string,
  billingCadence: "monthly" | "yearly"
): string {
  if (billingCadence === "yearly") {
    return `${planLabel} - yearly`;
  }
  return `${planLabel} - monthly`;
}

function accessPeriodLabel(
  billingCadence: "monthly" | "yearly",
  months: number
): string {
  if (billingCadence === "yearly") return "1 year";
  if (months === 1) return "1 month";
  return `${months} months`;
}

export function CheckoutSummary({
  planLabel,
  billingCadence,
  method,
  accessDurationMonths,
  pricing,
  lifetimeOneTime = false,
}: CheckoutSummaryProps): React.ReactElement {
  const due = computeCheckoutDueUsd({
    method,
    billingCadence,
    accessDurationMonths,
    pricing,
  });
  const renewal = lifetimeOneTime
    ? "Non-recurring - lifetime access"
    : renewalSummaryLine({
        method,
        billingCadence,
        accessDurationMonths,
      });

  const planLine = lifetimeOneTime
    ? `${planLabel} - one-time (lifetime)`
    : planLineLabel(planLabel, billingCadence);

  return (
    <div className="border-border bg-surface-hover/30 rounded-xl border px-5 py-5">
      <p className="text-text-secondary mb-4 text-xs font-semibold tracking-wide uppercase">
        Order summary
      </p>
      <dl className="space-y-3 text-sm">
        <div className="flex justify-between gap-6">
          <dt className="text-text-secondary shrink-0">Plan</dt>
          <dd className="text-text text-right leading-snug font-medium">
            {planLine}
          </dd>
        </div>
        <div className="flex justify-between gap-6">
          <dt className="text-text-secondary shrink-0">Payment</dt>
          <dd className="text-text text-right leading-snug font-medium">
            {paymentMethodLabel(method)}
          </dd>
        </div>
        {method === "lightning_one_time" ? (
          <div className="flex justify-between gap-6">
            <dt className="text-text-secondary shrink-0">Access</dt>
            <dd className="text-text text-right leading-snug font-medium">
              {lifetimeOneTime
                ? "Lifetime"
                : accessPeriodLabel(billingCadence, accessDurationMonths)}
            </dd>
          </div>
        ) : null}
        {lifetimeOneTime && method === "btc_onchain" ? (
          <div className="flex justify-between gap-6">
            <dt className="text-text-secondary shrink-0">Access</dt>
            <dd className="text-text text-right leading-snug font-medium">
              Lifetime
            </dd>
          </div>
        ) : null}
        <div className="border-border flex justify-between gap-6 border-t pt-3">
          <dt className="text-text-secondary shrink-0 pt-0.5">Due now</dt>
          <dd className="text-text text-right text-lg font-semibold tabular-nums">
            {due != null && due > 0 ? `$${due}` : due === 0 ? "Free" : "-"}
          </dd>
        </div>
        <div className="flex justify-between gap-6">
          <dt className="text-text-secondary shrink-0">Billing</dt>
          <dd className="text-text text-right leading-snug font-medium">
            {renewal}
          </dd>
        </div>
      </dl>
    </div>
  );
}
