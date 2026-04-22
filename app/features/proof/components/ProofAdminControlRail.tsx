import type { ReactNode } from "react";

import { Button } from "~/components/ui/button";
import type {
  ProofCardAspectRatio,
  ProofCardScope,
  ProofCardType,
} from "~/features/admin/proof-card-types";
import { proofRatioLabel, type ProofRatio } from "~/lib/proof";

const SCOPE_OPTIONS: Array<{ value: ProofCardScope; label: string }> = [
  { value: "hybrid", label: "Hybrid" },
  { value: "all-time", label: "All time" },
  { value: "selected-range", label: "Selected range" },
];

const TYPE_OPTIONS: Array<{ value: ProofCardType; label: string }> = [
  { value: "milestone", label: "Milestone" },
  { value: "range_performance", label: "Range" },
  { value: "reliability", label: "Reliability" },
  { value: "adoption", label: "Adoption" },
  { value: "product_progress", label: "Product" },
];

const RATIO_OPTIONS: Array<{ value: ProofCardAspectRatio; proof: ProofRatio }> =
  [
    { value: "4:5", proof: "portrait" },
    { value: "1:1", proof: "square" },
    { value: "16:9", proof: "landscape" },
  ];

function ratioHint(cardType: ProofCardType): string {
  switch (cardType) {
    case "product_progress":
      return "16:9 works well for embeds; 4:5 for social feeds.";
    case "reliability":
      return "4:5 or 1:1 keep the success % readable in-feed.";
    default:
      return "4:5 is tuned for mobile feeds.";
  }
}

export function ProofAdminControlRail({
  scope,
  onScopeChange,
  cardType,
  onCardTypeChange,
  aspectRatio,
  onAspectRatioChange,
  actionBar,
}: {
  scope: ProofCardScope;
  onScopeChange: (s: ProofCardScope) => void;
  cardType: ProofCardType;
  onCardTypeChange: (t: ProofCardType) => void;
  aspectRatio: ProofCardAspectRatio;
  onAspectRatioChange: (a: ProofCardAspectRatio) => void;
  actionBar: ReactNode;
}) {
  return (
    <div className="border-border bg-surface/30 flex flex-col gap-5 rounded-xl border p-4">
      <div className="space-y-2">
        <p className="text-text-secondary text-xs font-medium tracking-wide uppercase">
          Scope
        </p>
        <div className="flex flex-wrap gap-1.5">
          {SCOPE_OPTIONS.map((o) => (
            <Button
              key={o.value}
              type="button"
              size="sm"
              variant={scope === o.value ? "default" : "outline"}
              className="h-8"
              onClick={() => {
                onScopeChange(o.value);
              }}
            >
              {o.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-text-secondary text-xs font-medium tracking-wide uppercase">
          Card type
        </p>
        <div className="flex flex-col gap-1.5">
          {TYPE_OPTIONS.map((o) => (
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

      <div className="space-y-1">
        <p className="text-text-secondary text-xs font-medium tracking-wide uppercase">
          Ratio
        </p>
        <div className="flex flex-wrap gap-1.5">
          {RATIO_OPTIONS.map((o) => (
            <Button
              key={o.value}
              type="button"
              size="sm"
              variant={aspectRatio === o.value ? "default" : "outline"}
              className="h-8"
              onClick={() => {
                onAspectRatioChange(o.value);
              }}
            >
              {proofRatioLabel(o.proof)}
            </Button>
          ))}
        </div>
        <p className="text-text-secondary max-w-xs text-xs">
          {ratioHint(cardType)}
        </p>
      </div>

      <div className="border-border mt-auto border-t pt-4">{actionBar}</div>
    </div>
  );
}
