import type { ReactNode } from "react";

export function CampaignReceiptProofShell({
  receiptTitle,
  receiptBody,
  proofTitle,
  proofBody,
  actions,
}: {
  receiptTitle: string;
  receiptBody: ReactNode;
  proofTitle: string;
  proofBody: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="border-border bg-surface rounded-lg border p-4">
        <h2 className="mb-2 text-sm font-semibold">{receiptTitle}</h2>
        {receiptBody}
      </div>
      <div className="border-border bg-surface rounded-lg border p-4">
        <h2 className="mb-2 text-sm font-semibold">{proofTitle}</h2>
        {proofBody}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
