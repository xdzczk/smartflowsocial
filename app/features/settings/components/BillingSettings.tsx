import { useSearchParams } from "@remix-run/react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { NWCSettings, SubscriptionSettings } from "~/features/payments";
import { ReferralSettings } from "~/features/referral/components/ReferralSettings";
import {
  parseBillingSegmentParam,
  type BillingSegmentId,
} from "~/features/settings/settings-sections";

interface SubscriptionShape {
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
  plan: {
    id: string;
    name: string;
    price: number;
    enableLifetimeAccess: boolean;
  } | null;
}

interface BillingSettingsProps {
  subscription: SubscriptionShape | null;
  availablePlans: Array<{
    id: string;
    name: string;
    price: number;
    enableLifetimeAccess: boolean;
  }>;
  paymentHistory: Array<{
    id: string;
    amount: number;
    amountUsd: number | null;
    description: string | null;
    paidAt: Date | null;
    paymentMethod: string | null;
    paymentHash: string;
    planName?: string;
    planPrice?: number;
  }>;
  nwcEnabled: boolean;
  maskedNwcString: string | undefined;
  nwcLastUsed: string | null;
  referral: {
    referralLink: string;
    commissionRatePercent: number;
    totalEarnedSats: number;
    paidSats: number;
    pendingSats: number;
    failedSats: number;
    payoutDestination: string | null;
    payoutDestinationType: string | null;
  };
}

export function BillingSettings({
  subscription,
  availablePlans,
  paymentHistory,
  nwcEnabled,
  maskedNwcString,
  nwcLastUsed,
  referral,
}: BillingSettingsProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const segment = parseBillingSegmentParam(searchParams.get("billing"));

  const setSegment = (next: BillingSegmentId) => {
    const sp = new URLSearchParams(searchParams);
    if (next === "overview") {
      sp.delete("billing");
    } else {
      sp.set("billing", next);
    }
    setSearchParams(sp, { replace: true, preventScrollReset: true });
  };

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Tabs
        value={segment}
        onValueChange={(v) => setSegment(v as BillingSegmentId)}
        className="w-full"
      >
        <TabsList className="grid h-auto w-full max-w-md grid-cols-3 gap-1">
          <TabsTrigger value="overview" className="text-xs sm:text-sm">
            Overview
          </TabsTrigger>
          <TabsTrigger value="payments" className="text-xs sm:text-sm">
            Payments
          </TabsTrigger>
          <TabsTrigger value="referral" className="text-xs sm:text-sm">
            Referral
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <SubscriptionSettings
            subscription={subscription}
            availablePlans={availablePlans}
            paymentHistory={paymentHistory}
            nwcEnabled={nwcEnabled}
          />
        </TabsContent>

        <TabsContent value="payments" className="mt-6">
          <NWCSettings
            nwcEnabled={nwcEnabled}
            maskedNwcString={maskedNwcString}
            nwcLastUsed={nwcLastUsed}
          />
        </TabsContent>

        <TabsContent value="referral" className="mt-6">
          <ReferralSettings
            referralLink={referral.referralLink}
            commissionRatePercent={referral.commissionRatePercent}
            totalEarnedSats={referral.totalEarnedSats}
            paidSats={referral.paidSats}
            pendingSats={referral.pendingSats}
            failedSats={referral.failedSats}
            payoutDestination={referral.payoutDestination}
            payoutDestinationType={referral.payoutDestinationType}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
