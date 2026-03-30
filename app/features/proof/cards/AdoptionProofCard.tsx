import type { ProofCardPayload, ProofRatio } from "~/lib/proof";
import { proofCardInnerPadClass } from "~/lib/proof";

import { ProofCardBody } from "../components/ProofCardBody";
import { ProofCardShell } from "../components/ProofCardShell";

export function AdoptionProofCard({
  payload,
  ratio,
}: {
  payload: ProofCardPayload;
  ratio: ProofRatio;
}) {
  return (
    <ProofCardShell ratio={ratio} variant="admin">
      <div className={proofCardInnerPadClass(ratio)}>
        <ProofCardBody payload={payload} ratio={ratio} variant="admin" />
      </div>
    </ProofCardShell>
  );
}
