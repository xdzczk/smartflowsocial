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
import { BRAND_NAME } from "~/lib/brand";

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

function truncateMiddle(url: string, max = 42) {
  if (url.length <= max) return url;
  const half = Math.floor((max - 3) / 2);
  return `${url.slice(0, half)}…${url.slice(-half)}`;
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

  const zeroEarnings =
    totalEarnedSats === 0 && paidSats === 0 && pendingSats === 0;

  return (
    <div className="space-y-6">
      <AccountSummarySection
        title="Referral earnings"
        description={`${commissionRatePercent}% lifetime commission when someone you refer subscribes to a paid plan.`}
        summary={
          <div className="space-y-4">
            {zeroEarnings ? (
              <p className="text-text-secondary text-sm">
                No referral earnings yet. Share your referral link below—when
                referred users upgrade to a paid plan, you earn sats.
              </p>
            ) : null}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="bg-surface-hover/40 rounded-lg border p-4">
                <p className="text-text-secondary text-xs font-medium tracking-wide uppercase">
                  Total earned
                </p>
                <p className="text-text mt-2 text-2xl font-semibold tabular-nums">
                  {totalEarnedSats.toLocaleString()}{" "}
                  <span className="text-text-secondary text-base font-normal">
                    sats
                  </span>
                </p>
              </div>
              <div className="bg-surface-hover/40 rounded-lg border p-4">
                <p className="text-text-secondary text-xs font-medium tracking-wide uppercase">
                  Paid out
                </p>
                <p className="text-text mt-2 text-2xl font-semibold tabular-nums">
                  {paidSats.toLocaleString()}
                </p>
              </div>
              <div className="bg-surface-hover/40 rounded-lg border p-4">
                <p className="text-text-secondary text-xs font-medium tracking-wide uppercase">
                  Pending
                </p>
                <p className="text-text mt-2 text-2xl font-semibold tabular-nums">
                  {pendingSats.toLocaleString()}
                </p>
              </div>
            </div>
            {failedSats > 0 ? (
              <div className="border-danger/30 bg-danger/5 rounded-lg border p-3">
                <p className="text-danger text-xs font-medium uppercase">
                  Failed payout
                </p>
                <p className="text-danger mt-1 text-lg font-semibold tabular-nums">
                  {failedSats.toLocaleString()} sats
                </p>
              </div>
            ) : null}
          </div>
        }
      />

      <PreferenceSection
        title="Referral link"
        description={`Share this link to sign people up with your referral. Earnings apply when they subscribe to a paid ${BRAND_NAME} plan.`}
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
        description="Lightning payout URL (LNURL-pay, Lightning address, or compatible HTTPS endpoint). Pending earnings are held until you save a valid destination."
      >
        {!payoutDestination ? (
          <p className="text-text-secondary mb-3 text-sm">
            Pending earnings cannot be paid out until you add a payout
            destination.
          </p>
        ) : (
          <div className="bg-surface-hover/30 mb-3 rounded-md border border-dashed px-3 py-2">
            <p className="text-text-secondary text-xs font-medium uppercase">
              Saved
            </p>
            <p
              className="text-text mt-0.5 font-mono text-sm break-all"
              title={payoutDestination}
            >
              {truncateMiddle(payoutDestination)}
            </p>
          </div>
        )}
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
                placeholder="https://… or Lightning address"
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
              variant={payoutDestination ? "outline" : "default"}
              disabled={fetcher.state !== "idle"}
              size="sm"
              className="shrink-0"
            >
              {fetcher.state !== "idle" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Save payout destination"
              )}
            </Button>
          </div>
        </Form>
      </PreferenceSection>
    </div>
  );
}
