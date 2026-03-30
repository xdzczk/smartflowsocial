import type { ProofCardPayload, ProofRatio } from "~/lib/proof";
import { proofCardInnerPadClass } from "~/lib/proof";

import { ProofCardBody } from "../components/ProofCardBody";
import { ProofCardShell } from "../components/ProofCardShell";

export function FairnessProofCard({
  payload,
  ratio,
}: {
  payload: ProofCardPayload;
  ratio: ProofRatio;
}) {
  return (
    <ProofCardShell ratio={ratio} variant="campaign">
      <div className={proofCardInnerPadClass(ratio)}>
        <ProofCardBody payload={payload} ratio={ratio} variant="campaign" />
      </div>
    </ProofCardShell>
  );
}
