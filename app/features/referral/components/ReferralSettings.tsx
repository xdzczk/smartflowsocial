import { Form, useFetcher } from "@remix-run/react";
import { Copy, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

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
      <div className="space-y-2">
        <Label>Referral link</Label>
        <div className="flex gap-2">
          <Input readOnly value={referralLink} className="font-mono text-sm" />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => {
              void copyLink();
            }}
            aria-label="Copy referral link"
          >
            {copied ? (
              <span className="text-xs">Copied</span>
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <div className="text-muted-foreground text-sm">
        Commission rate: <strong>{commissionRatePercent}%</strong> (lifetime)
      </div>

      <div className="grid gap-2 text-sm">
        <div>
          Total earned: <strong>{totalEarnedSats.toLocaleString()} sats</strong>
        </div>
        <div>
          Paid: <strong>{paidSats.toLocaleString()} sats</strong>
        </div>
        <div>
          Pending: <strong>{pendingSats.toLocaleString()} sats</strong>
        </div>
        {failedSats > 0 ? (
          <div className="text-destructive">
            Failed (contact support):{" "}
            <strong>{failedSats.toLocaleString()} sats</strong>
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="payout_destination">
          Payout destination (LNURL or LN address URL)
        </Label>
        <p className="text-muted-foreground text-xs">
          Earnings stay pending until you set a payout address. Use an LNURL pay
          URL or Lightning address service URL so we can send you payments.
        </p>
        <Form method="post">
          <input type="hidden" name="_action" value="referral_save_payout" />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Input
              id="payout_destination"
              name="payout_destination"
              type="url"
              placeholder="https://..."
              defaultValue={payoutDestination ?? ""}
              className="font-mono text-sm"
            />
            <input
              type="hidden"
              name="payout_destination_type"
              value={payoutDestinationType ?? "lnurl"}
            />
            <Button type="submit" disabled={fetcher.state !== "idle"}>
              {fetcher.state !== "idle" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </Form>
      </div>
    </div>
  );
}
