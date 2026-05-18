import type { ReactNode } from "react";

import {
  proofCardAspectOuterClass,
  proofCardShellSurfaceClass,
  type ProofRatio,
} from "~/lib/proof";

export function ProofCardShell({
  ratio,
  variant,
  children,
}: {
  ratio: ProofRatio;
  variant: "campaign" | "admin";
  children: ReactNode;
}) {
  return (
    <div data-proof-card-root className={proofCardAspectOuterClass(ratio)}>
      <div
        data-proof-card-surface
        className={proofCardShellSurfaceClass(variant)}
      >
        {children}
      </div>
    </div>
  );
}
