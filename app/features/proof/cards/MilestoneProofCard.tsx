import type { ProofCardPayload, ProofRatio } from "~/lib/proof";
import { proofCardInnerPadClass, proofCardShellClass } from "~/lib/proof";

import { ProofCardBody } from "../components/ProofCardBody";

export function MilestoneProofCard({
  payload,
  ratio,
}: {
  payload: ProofCardPayload;
  ratio: ProofRatio;
}) {
  return (
    <div className={proofCardShellClass(ratio, "admin")}>
      <div className={proofCardInnerPadClass(ratio)}>
        <ProofCardBody payload={payload} ratio={ratio} variant="admin" />
      </div>
    </div>
  );
}
