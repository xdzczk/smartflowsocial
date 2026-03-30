import type { ProofCardPayload, ProofRatio } from "~/lib/proof";
import { proofCardInnerPadClass, proofCardShellClass } from "~/lib/proof";

import { ProofCardBody } from "../components/ProofCardBody";

export function PublicSummaryCard({
  payload,
  ratio,
}: {
  payload: ProofCardPayload;
  ratio: ProofRatio;
}) {
  return (
    <div className={proofCardShellClass(ratio, "campaign")}>
      <div className={proofCardInnerPadClass(ratio)}>
        <ProofCardBody payload={payload} ratio={ratio} variant="campaign" />
      </div>
    </div>
  );
}
