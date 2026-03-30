import { Form, useFetcher } from "@remix-run/react";
import { Copy, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  AccountSummarySection,
  PreferenceSection,
} from "~/features/settings/components/patterns";

export interface ReferralSettingsProps {
  referralLink: string;
  commissionRatePercent: number;
  totalEarnedSats: number;
  paidSats: number;
  pendingSats: number;
  failedSats: number;
  payoutDestination: string | null;
  payoutDestinationType: string | null;
}

export function ReferralSettings({
  referralLink,
  commissionRatePercent,
  totalEarnedSats,
  paidSats,
  pendingSats,
  failedSats,
  payoutDestination,
  payoutDestinationType,
}: ReferralSettingsProps) {
  const [copied, setCopied] = useState(false);
  const fetcher = useFetcher();

  const copyLink = useCallback(async () => {
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [referralLink]);

  return (
    <div className="space-y-6">
      <AccountSummarySection
        title="Referral earnings"
        description={`${commissionRatePercent}% lifetime commission on referred subscriptions.`}
        summary={
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Total earned
              </dt>
              <dd className="text-foreground mt-1 text-lg font-semibold tabular-nums">
                {totalEarnedSats.toLocaleString()}{" "}
                <span className="text-muted-foreground text-sm font-normal">
                  sats
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Paid out
              </dt>
              <dd className="text-foreground mt-1 text-lg font-semibold tabular-nums">
                {paidSats.toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Pending
              </dt>
              <dd className="text-foreground mt-1 text-lg font-semibold tabular-nums">
                {pendingSats.toLocaleString()}
              </dd>
            </div>
            {failedSats > 0 ? (
              <div>
                <dt className="text-destructive text-xs font-medium tracking-wide uppercase">
                  Failed
                </dt>
                <dd className="text-destructive mt-1 text-lg font-semibold tabular-nums">
                  {failedSats.toLocaleString()}
                </dd>
              </div>
            ) : null}
          </dl>
        }
      />

      <PreferenceSection
        title="Your referral link"
        description="Share this link to earn when people subscribe through SmartFlow."
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <Input
            readOnly
            value={referralLink}
            className="min-w-0 font-mono text-sm"
          />
          <Button
            type="button"
            variant="outline"
            className="shrink-0 sm:w-auto"
            onClick={() => {
              void copyLink();
            }}
            aria-label="Copy referral link"
          >
            {copied ? "Copied" : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </PreferenceSection>

      <PreferenceSection
        title="Payout destination"
        description="Earnings stay pending until you set a Lightning payout URL (LNURL pay or similar)."
      >
        <Form method="post">
          <input type="hidden" name="_action" value="referral_save_payout" />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-2">
              <Label
                htmlFor="payout_destination"
                className="sr-only sm:not-sr-only"
              >
                Payout URL
              </Label>
              <Input
                id="payout_destination"
                name="payout_destination"
                type="url"
                placeholder="https://..."
                defaultValue={payoutDestination ?? ""}
                className="font-mono text-sm"
              />
            </div>
            <input
              type="hidden"
              name="payout_destination_type"
              value={payoutDestinationType ?? "lnurl"}
            />
            <Button
              type="submit"
              disabled={fetcher.state !== "idle"}
              size="sm"
              className="shrink-0"
            >
              {fetcher.state !== "idle" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Save payout"
              )}
            </Button>
          </div>
        </Form>
      </PreferenceSection>
    </div>
  );
}
