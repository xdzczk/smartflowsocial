import { format } from "date-fns";

import type { BillingContext } from "~/features/payments/types/subscription-billing.types";

export function formatBillingPaidUntil(
  value: Date | string | null
): string | null {
  if (value == null) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return null;
  return format(d, "dd MMM yyyy");
}

/** Primary CTA for billing alerts and overview (labels aligned with Billing tab copy). */
export function billingContextPrimaryCta(
  primary: BillingContext["primaryCta"]
): { label: string; to: string } {
  switch (primary) {
    case "manage_nwc":
      return {
        label: "Manage auto-renew wallet",
        to: "/dashboard/settings?billing=payments",
      };
    case "connect_nwc":
      return {
        label: "Connect wallet",
        to: "/dashboard/settings?billing=payments",
      };
    case "top_up_subscription":
    case "extend_plan":
    case "top_up_wallet":
      return { label: "Extend subscription", to: "/plans" };
    default:
      return { label: "View plans", to: "/plans" };
  }
}

export function billingModeLabel(commMode: BillingContext["commMode"]): string {
  return commMode === "AUTO_RENEW_NWC"
    ? "Auto-renew via connected wallet (NWC)"
    : "Manual renewal (Lightning)";
}
