import { useEffect, useMemo, useRef, useState } from "react";

import { ProofActionBar } from "~/features/proof/components/ProofActionBar";
import { ProofAdminControlRail } from "~/features/proof/components/ProofAdminControlRail";
import { ProofCardRenderer } from "~/features/proof/components/ProofCardRenderer";
import { ProofPreviewStage } from "~/features/proof/components/ProofPreviewStage";
import { ProofStudioAdminLayout } from "~/features/proof/components/ProofStudioLayout";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import type { ProofRatio } from "~/lib/proof";

import type {
  ProofCardAspectRatio,
  ProofCardData,
  ProofCardScope,
  ProofCardType,
} from "../proof-card-types";
import { buildAdminProofPayload } from "../proof-studio-payload";

const ASPECT_TO_RATIO: Record<ProofCardAspectRatio, ProofRatio> = {
  "4:5": "portrait",
  "1:1": "square",
  "16:9": "landscape",
};

const PROOF_PREFS_KEY = "__sfs_admin_proof_export_prefs";

export function AdminProofOfWorkSection({
  proofCard,
}: {
  proofCard: ProofCardData;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [scope, setScope] = useState<ProofCardScope>("hybrid");
  const [cardType, setCardType] = useState<ProofCardType>("milestone");
  const [aspectRatio, setAspectRatio] = useState<ProofCardAspectRatio>("4:5");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PROOF_PREFS_KEY);
      if (!raw) return;
      const o = JSON.parse(raw) as Partial<{
        scope: ProofCardScope;
        cardType: ProofCardType;
        aspectRatio: ProofCardAspectRatio;
      }>;
      /* eslint-disable react-hooks/set-state-in-effect -- one-time restore from localStorage after mount */
      if (o.scope) setScope(o.scope);
      if (o.cardType) setCardType(o.cardType);
      if (o.aspectRatio) setAspectRatio(o.aspectRatio);
      /* eslint-enable react-hooks/set-state-in-effect */
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        PROOF_PREFS_KEY,
        JSON.stringify({ scope, cardType, aspectRatio })
      );
    } catch {
      /* ignore */
    }
  }, [scope, cardType, aspectRatio]);

  const { formatDate, dateLocale } = useFormattedDate();

  const proofRatio = ASPECT_TO_RATIO[aspectRatio];

  const payload = useMemo(
    () =>
      buildAdminProofPayload(
        scope,
        cardType,
        proofRatio,
        proofCard,
        (iso) =>
          formatDate(iso, {
            dateFormatOptions: {
              dateStyle: "medium",
              timeStyle: "short",
            },
          }),
        dateLocale
      ),
    [scope, cardType, proofRatio, proofCard, formatDate, dateLocale]
  );

  const reliabilitySampleLow =
    cardType === "reliability" &&
    proofCard.last30d.successfulShortPublishes +
      proofCard.last30d.failedShortPublishes <
      10;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Proof Studio</h2>
        <p className="text-text-secondary mt-1 max-w-xl text-sm">
          Public proof-of-work cards for the selected analytics range — same
          engine as giveaway and contest proof exports.
        </p>
      </div>

      {reliabilitySampleLow ? (
        <p className="text-text-secondary border-border border-warning/20 bg-warning/5 rounded-lg border px-3 py-2 text-xs leading-snug">
          Low sample for 30d reliability stats — interpret exports carefully or
          pick a longer window in the admin range before sharing.
        </p>
      ) : null}

      <ProofStudioAdminLayout
        preview={
          <ProofPreviewStage>
            <div ref={cardRef} className="flex w-full justify-center">
              <ProofCardRenderer payload={payload} ratio={proofRatio} />
            </div>
          </ProofPreviewStage>
        }
        controlRail={
          <ProofAdminControlRail
            scope={scope}
            onScopeChange={setScope}
            cardType={cardType}
            onCardTypeChange={setCardType}
            aspectRatio={aspectRatio}
            onAspectRatioChange={setAspectRatio}
            actionBar={
              <ProofActionBar
                cardRef={cardRef}
                payload={payload}
                ratio={proofRatio}
                copyCaptionLabel="Copy Nostr caption"
                copySummaryLabel="Copy text summary"
              />
            }
          />
        }
      />
    </section>
  );
}
