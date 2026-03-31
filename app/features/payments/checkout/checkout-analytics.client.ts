export type CheckoutAnalyticsSource = "plans_page";

export type CheckoutAnalyticsEventName =
  | "checkout_opened"
  | "payment_method_selected"
  | "access_period_changed"
  | "nwc_input_started"
  | "nwc_input_valid"
  | "lightning_invoice_generated"
  | "btcpay_redirect_started"
  | "payment_modal_opened"
  | "payment_modal_closed"
  | "checkout_closed"
  | "payment_completed"
  | "payment_failed"
  | "payment_abandoned";

export interface CheckoutAnalyticsPayload {
  plan?: string;
  cadence?: "monthly" | "yearly";
  method?: string;
  accessPeriodMonths?: number;
  source?: CheckoutAnalyticsSource;
  [key: string]: unknown;
}

export function trackCheckoutEvent(
  name: CheckoutAnalyticsEventName,
  payload: CheckoutAnalyticsPayload = {}
): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent("smartflow:checkout-analytics", {
        detail: { name, payload, at: Date.now() },
      })
    );
  } catch {
    // ignore
  }
}
