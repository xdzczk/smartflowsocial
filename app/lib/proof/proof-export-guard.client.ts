/** Blocks foreground revalidation while a proof PNG export is in flight. */
let proofExportInFlight = 0;

export function beginProofExport(): () => void {
  proofExportInFlight += 1;
  return () => {
    proofExportInFlight = Math.max(0, proofExportInFlight - 1);
  };
}

export function isProofExportInFlight(): boolean {
  return proofExportInFlight > 0;
}

export function isProofStudioPath(pathname: string): boolean {
  return (
    pathname === "/dashboard/giveaway/proof" ||
    pathname === "/dashboard/contests/proof"
  );
}
