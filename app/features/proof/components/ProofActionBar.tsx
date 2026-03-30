import { Link } from "@remix-run/react";
import { useCallback, useState } from "react";
import { toast } from "react-hot-toast";

import { Button } from "~/components/ui/button";
import {
  buildProofCaption,
  buildProofSummary,
  exportProofCardPng,
  proofExportFilename,
  type ProofCardPayload,
  type ProofRatio,
} from "~/lib/proof";

export function ProofActionBar({
  cardRef,
  payload,
  ratio,
  openSourceHref,
  openSourceLabel = "Open source",
  copyCaptionLabel = "Copy caption",
  copySummaryLabel = "Copy summary",
}: {
  cardRef: React.RefObject<HTMLElement | null>;
  payload: ProofCardPayload;
  ratio: ProofRatio;
  openSourceHref?: string;
  openSourceLabel?: string;
  copyCaptionLabel?: string;
  copySummaryLabel?: string;
}) {
  const [busy, setBusy] = useState(false);

  const onExport = useCallback(async () => {
    const el = cardRef.current;
    if (!el) {
      toast.error("Nothing to export");
      return;
    }
    setBusy(true);
    try {
      await exportProofCardPng({
        element: el,
        ratio,
        filename: proofExportFilename({
          domain: payload.domain,
          cardType: payload.cardType,
        }),
      });
      toast.success("PNG exported");
    } catch {
      toast.error("Export failed");
    } finally {
      setBusy(false);
    }
  }, [cardRef, payload.cardType, payload.domain, ratio]);

  const onCopySummary = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(buildProofSummary(payload));
      toast.success("Summary copied");
    } catch {
      toast.error("Copy failed");
    }
  }, [payload]);

  const onCopyCaption = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(buildProofCaption(payload));
      toast.success("Caption copied");
    } catch {
      toast.error("Copy failed");
    }
  }, [payload]);

  return (
    <div className="border-border space-y-2 border-t pt-4">
      <Button
        type="button"
        className="w-full"
        disabled={busy}
        onClick={() => {
          void onExport();
        }}
      >
        {busy ? "Exporting…" : "Export PNG"}
      </Button>
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={() => {
          void onCopyCaption();
        }}
      >
        {copyCaptionLabel}
      </Button>
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={() => {
          void onCopySummary();
        }}
      >
        {copySummaryLabel}
      </Button>
      {openSourceHref ? (
        <Button type="button" variant="outline" className="w-full" asChild>
          <Link to={openSourceHref}>{openSourceLabel}</Link>
        </Button>
      ) : null}
    </div>
  );
}
