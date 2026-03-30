import type { ProofCardPayload, ProofCardType, ProofRatio } from "~/lib/proof";

import { AdoptionProofCard } from "../cards/AdoptionProofCard";
import { FairnessProofCard } from "../cards/FairnessProofCard";
import { MilestoneProofCard } from "../cards/MilestoneProofCard";
import { ProductProofCard } from "../cards/ProductProofCard";
import { PublicSummaryCard } from "../cards/PublicSummaryCard";
import { RangeProofCard } from "../cards/RangeProofCard";
import { ReceiptProofCard } from "../cards/ReceiptProofCard";
import { ReliabilityProofCard } from "../cards/ReliabilityProofCard";

export function ProofCardRenderer({
  payload,
  ratio,
}: {
  payload: ProofCardPayload;
  ratio: ProofRatio;
}) {
  const t: ProofCardType = payload.cardType;

  switch (t) {
    case "public-summary":
      return <PublicSummaryCard payload={payload} ratio={ratio} />;
    case "fairness-proof":
      return <FairnessProofCard payload={payload} ratio={ratio} />;
    case "receipt":
      return <ReceiptProofCard payload={payload} ratio={ratio} />;
    case "milestone":
      return <MilestoneProofCard payload={payload} ratio={ratio} />;
    case "reliability":
      return <ReliabilityProofCard payload={payload} ratio={ratio} />;
    case "adoption":
      return <AdoptionProofCard payload={payload} ratio={ratio} />;
    case "product":
      return <ProductProofCard payload={payload} ratio={ratio} />;
    case "range":
      return <RangeProofCard payload={payload} ratio={ratio} />;
  }
}
