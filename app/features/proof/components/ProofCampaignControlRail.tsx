import type { ReactNode } from "react";

import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import {
  proofRatioLabel,
  type ProofCardType,
  type ProofRatio,
} from "~/lib/proof";
import { cn } from "~/lib/utils";

const CAMPAIGN_CARD_TYPES: Array<{
  value: Extract<
    ProofCardType,
    "public-summary" | "fairness-proof" | "receipt"
  >;
  label: string;
}> = [
  { value: "public-summary", label: "Public summary" },
  { value: "fairness-proof", label: "Fairness proof" },
  { value: "receipt", label: "Receipt" },
];

const RATIOS: ProofRatio[] = ["portrait", "square", "landscape"];

export function ProofCampaignControlRail({
  selectedSummary,
  cardType,
  onCardTypeChange,
  ratio,
  onRatioChange,
  showLogo,
  onShowLogoChange,
  showReferenceId,
  onShowReferenceIdChange,
  showTimestamp,
  onShowTimestampChange,
  actionBar,
}: {
  selectedSummary: ReactNode;
  cardType: Extract<
    ProofCardType,
    "public-summary" | "fairness-proof" | "receipt"
  >;
  onCardTypeChange: (
    t: Extract<ProofCardType, "public-summary" | "fairness-proof" | "receipt">
  ) => void;
  ratio: ProofRatio;
  onRatioChange: (r: ProofRatio) => void;
  showLogo: boolean;
  onShowLogoChange: (v: boolean) => void;
  showReferenceId: boolean;
  onShowReferenceIdChange: (v: boolean) => void;
  showTimestamp: boolean;
  onShowTimestampChange: (v: boolean) => void;
  actionBar: ReactNode;
}) {
  return (
    <div className="border-border bg-card/30 flex flex-col gap-6 rounded-xl border p-4">
      <div className="space-y-2">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Selected
        </p>
        {selectedSummary}
      </div>

      <div className="space-y-2">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Card type
        </p>
        <div className="flex flex-col gap-1.5">
          {CAMPAIGN_CARD_TYPES.map((o) => (
            <Button
              key={o.value}
              type="button"
              size="sm"
              variant={cardType === o.value ? "default" : "outline"}
              className="h-9 w-full justify-start font-normal"
              onClick={() => {
                onCardTypeChange(o.value);
              }}
            >
              {o.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Ratio
        </p>
        <div className="flex flex-wrap gap-1.5">
          {RATIOS.map((r) => (
            <Button
              key={r}
              type="button"
              size="sm"
              variant={ratio === r ? "default" : "outline"}
              className="h-8"
              onClick={() => {
                onRatioChange(r);
              }}
            >
              {proofRatioLabel(r)}
            </Button>
          ))}
        </div>
      </div>

      <div className="border-border/60 space-y-3 border-t pt-4">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Options
        </p>
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="proof-show-logo" className="text-sm font-normal">
            SmartFlow branding
          </Label>
          <Switch
            id="proof-show-logo"
            checked={showLogo}
            onCheckedChange={onShowLogoChange}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="proof-ref" className="text-sm font-normal">
            Reference in footer
          </Label>
          <Switch
            id="proof-ref"
            checked={showReferenceId}
            onCheckedChange={onShowReferenceIdChange}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="proof-time" className="text-sm font-normal">
            Timestamp in footer
          </Label>
          <Switch
            id="proof-time"
            checked={showTimestamp}
            onCheckedChange={onShowTimestampChange}
          />
        </div>
      </div>

      <div className={cn("border-border/60 mt-auto border-t pt-2")}>
        {actionBar}
      </div>
    </div>
  );
}
