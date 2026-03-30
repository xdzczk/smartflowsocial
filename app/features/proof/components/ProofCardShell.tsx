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
    <div className={proofCardAspectOuterClass(ratio)}>
      <div className={proofCardShellSurfaceClass(variant)}>{children}</div>
    </div>
  );
}
