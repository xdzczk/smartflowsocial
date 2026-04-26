import { Link } from "@remix-run/react";

import type { BillingContext } from "~/features/payments/types/subscription-billing.types";

import {
  billingContextPrimaryCta,
  billingModeLabel,
  formatBillingPaidUntil,
} from "./billing-overview-helpers";

function bannerCopy(
  ctx: BillingContext
): { title: string; description: string } | null {
  const paidUntil = formatBillingPaidUntil(ctx.paidUntil);
  switch (ctx.bannerVariant) {
    case "none":
      return null;
    case "nwc_renewal_soon":
      return {
        title: "Renewal coming up",
        description:
          "Your subscription renews soon. Check your NWC wallet connection and balance.",
      };
    case "nwc_renewal_24h":
      return {
        title: "Renewal in about 24 hours",
        description:
          "Auto-renew runs via NWC soon. Make sure your wallet is ready.",
      };
    case "nwc_renewal_failed_grace":
      return {
        title: "Renewal issue — grace period",
        description:
          "We couldn’t renew via NWC. Reconnect your wallet or top up manually before grace ends.",
      };
    case "nwc_grace_ending":
      return {
        title: "Grace period ends soon",
        description:
          "Reconnect NWC or top up now to avoid moving to the Free plan.",
      };
    case "nwc_downgraded":
      return {
        title: "You’re on the Free plan",
        description: "Restore paid features any time from Billing or Plans.",
      };
    case "manual_period_ending":
      return {
        title: paidUntil
          ? `Paid period ends ${paidUntil}`
          : "Paid period ending soon",
        description:
          "This account uses manual top-ups. Extend your subscription to keep uninterrupted access.",
      };
    case "manual_ends_tomorrow":
      return {
        title: "Paid period ends in about 24 hours",
        description: "Top up now to avoid downgrade to Free.",
      };
    case "manual_expired":
      return {
        title: "Paid period ended",
        description:
          "You’re on Free until you top up. Extend your subscription to restore paid features.",
      };
    case "manual_downgraded":
      return {
        title: "You’re on the Free plan",
        description: "Top up any time to restore paid features.",
      };
    default:
      return null;
  }
}

export function BillingAlertBanner({
  billingContext,
}: {
  billingContext: BillingContext | null | undefined;
}) {
  if (!billingContext) return null;
  const copy = bannerCopy(billingContext);
  if (!copy) return null;
  const { label, to } = billingContextPrimaryCta(billingContext.primaryCta);

  return (
    <div className="max-w-page mx-auto w-full px-4 pt-4 sm:px-6 lg:px-8">
      <div className="border-border bg-surface-hover text-text-secondary mb-4 flex items-start justify-between gap-3 rounded-lg border p-4">
        <div>
          <p className="font-medium">{copy.title}</p>
          <p className="text-sm opacity-90">{copy.description}</p>
        </div>
        <Link
          prefetch="intent"
          to={to}
          className="focus-ring bg-action-primary text-action-primary-foreground hover:bg-action-primary/90 inline-flex shrink-0 items-center rounded-md px-3 py-2 text-sm font-medium"
        >
          {label}
        </Link>
      </div>
    </div>
  );
}

export function BillingStatusCard({
  billingContext,
}: {
  billingContext: BillingContext | null | undefined;
}) {
  if (!billingContext || billingContext.uiStatus === "FREE") return null;

  const modeLabel = billingModeLabel(billingContext.commMode);
  const paidUntil = formatBillingPaidUntil(billingContext.paidUntil);
  const { label, to } = billingContextPrimaryCta(billingContext.primaryCta);

  return (
    <div className="border-border bg-surface mb-4 rounded-lg border p-4">
      <h3 className="mb-2 text-sm font-semibold">Billing</h3>
      <dl className="text-text-secondary space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <dt>Billing mode</dt>
          <dd className="text-text text-right font-medium">{modeLabel}</dd>
        </div>
        {paidUntil ? (
          <div className="flex justify-between gap-4">
            <dt>Current paid period ends</dt>
            <dd className="text-text text-right">{paidUntil}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-4">
          <dt>Status</dt>
          <dd className="text-text text-right font-medium">
            {billingContext.uiStatus.replace(/_/g, " ")}
          </dd>
        </div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          to={to}
          prefetch="intent"
          className="bg-action-primary text-action-primary-foreground hover:bg-action-primary/90 inline-flex rounded-md px-3 py-1.5 text-xs font-medium"
        >
          {label}
        </Link>
        <Link
          to="/dashboard/settings?billing=overview"
          prefetch="intent"
          className="border-border hover:bg-surface-hover inline-flex rounded-md border px-3 py-1.5 text-xs font-medium"
        >
          Billing settings
        </Link>
      </div>
    </div>
  );
}
