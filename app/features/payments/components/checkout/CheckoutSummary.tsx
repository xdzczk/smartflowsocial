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
      return "Auto-renew with wallet";
    case "lightning_one_time":
      return "One-time Lightning invoice";
    case "btc_onchain":
      return "Bitcoin on-chain";
    default:
      return "";
  }
}

function planLineLabel(
  planLabel: string,
  billingCadence: "monthly" | "yearly"
): string {
  if (billingCadence === "yearly") {
    return `${planLabel} — yearly`;
  }
  return `${planLabel} — monthly`;
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
    ? "Non-recurring — lifetime access"
    : renewalSummaryLine({
        method,
        billingCadence,
        accessDurationMonths,
      });

  const planLine = lifetimeOneTime
    ? `${planLabel} — one-time (lifetime)`
    : planLineLabel(planLabel, billingCadence);

  return (
    <div className="border-border bg-muted/20 rounded-lg border px-4 py-3">
      <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
        Summary
      </p>
      <dl className="space-y-1.5 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Plan</dt>
          <dd className="text-foreground text-right font-medium">{planLine}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Payment</dt>
          <dd className="text-foreground text-right font-medium">
            {paymentMethodLabel(method)}
          </dd>
        </div>
        {method === "lightning_one_time" ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Access period</dt>
            <dd className="text-foreground text-right font-medium">
              {lifetimeOneTime
                ? "Lifetime"
                : accessPeriodLabel(billingCadence, accessDurationMonths)}
            </dd>
          </div>
        ) : null}
        {lifetimeOneTime && method === "btc_onchain" ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Access period</dt>
            <dd className="text-foreground text-right font-medium">Lifetime</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Due now</dt>
          <dd className="text-foreground text-right font-medium">
            {due != null && due > 0 ? `$${due}` : due === 0 ? "Free" : "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Renewal</dt>
          <dd className="text-foreground text-right font-medium">{renewal}</dd>
        </div>
      </dl>
    </div>
  );
}
