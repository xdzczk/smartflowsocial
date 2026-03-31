import type { BillingContext } from "~/features/payments/types/subscription-billing.types";

export interface Plan {
  id: string;
  name: string;
  price: number;
  enableLifetimeAccess: boolean;
}

export interface Subscription {
  id: string;
  planId: string | null;
  status: string;
  renewalMode?: string;
  billingCadence?: string;
  accessDurationMonths?: number;
  billingPaymentMethod?: string;
  renewalFailureCount?: number;
  lastRenewalAttemptAt?: Date | null;
  nextRenewalAttemptAt?: Date | null;
  gracePeriodEndsAt?: Date | null;
  startDate: Date;
  currentPeriodEnd: Date | null;
  nextPaymentDue: Date | null;
  cancelAtPeriodEnd: boolean;
  plan: Plan | null;
}

export interface PaymentHistory {
  id: string;
  amount: number;
  amountUsd: number | null;
  description: string | null;
  paidAt: Date | null;
  paymentMethod: string | null;
  paymentHash: string;
  planName?: string;
  planPrice?: number;
}

export interface SubscriptionSettingsProps {
  subscription: Subscription | null;
  availablePlans: Plan[];
  nwcEnabled: boolean;
  billingContext: BillingContext | null;
}
