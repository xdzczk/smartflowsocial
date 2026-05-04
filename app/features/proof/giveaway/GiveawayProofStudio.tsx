import { Link } from "@remix-run/react";
import { useMemo, useRef, useState } from "react";

import { Badge } from "~/components/ui/badge";
import type { ProofRatio } from "~/lib/proof";
import {
  buildGiveawayProofPayload,
  type GiveawayProofStudioDto,
} from "~/lib/proof/adapters/giveaway";
import { cn } from "~/lib/utils";

import { ProofActionBar } from "../components/ProofActionBar";
import { ProofCampaignControlRail } from "../components/ProofCampaignControlRail";
import { ProofCardRenderer } from "../components/ProofCardRenderer";
import { ProofEntitySelector } from "../components/ProofEntitySelector";
import { ProofPreviewStage } from "../components/ProofPreviewStage";
import { ProofStudioLayout } from "../components/ProofStudioLayout";

type CampaignCardType = "public-summary" | "fairness-proof" | "receipt";

export function GiveawayProofStudio({
  giveaways,
}: {
  giveaways: GiveawayProofStudioDto[];
}) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cardType, setCardType] = useState<CampaignCardType>("public-summary");
  const [ratio, setRatio] = useState<ProofRatio>("portrait");
  const [showLogo, setShowLogo] = useState(true);
  const [showReferenceId, setShowReferenceId] = useState(false);
  const [showTimestamp, setShowTimestamp] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return giveaways;
    return giveaways.filter(
      (g) =>
        g.title.toLowerCase().includes(q) ||
        g.id.toLowerCase().includes(q) ||
        g.scopeSummaryLabel.toLowerCase().includes(q)
    );
  }, [giveaways, search]);

  const selected = useMemo(() => {
    const pool = filtered.length > 0 ? filtered : giveaways;
    const byId = pool.find((g) => g.id === selectedId);
    if (byId) return byId;
    return pool[0] ?? null;
  }, [filtered, giveaways, selectedId]);

  const payload = useMemo(() => {
    if (!selected) return null;
    return buildGiveawayProofPayload(selected, cardType, ratio, {
      showLogo,
      showReferenceId,
      showTimestamp,
    });
  }, [selected, cardType, ratio, showLogo, showReferenceId, showTimestamp]);

  const header = (
    <div>
      <h1 className="text-text text-2xl font-semibold">Proof Studio</h1>
      <p className="text-text-secondary mt-1 max-w-2xl text-sm">
        Create shareable proof cards for completed giveaways - preview, switch
        templates, and export PNGs.
      </p>
    </div>
  );

  if (giveaways.length === 0) {
    return (
      <div className="space-y-6">
        {header}
        <p className="text-text-secondary text-sm">
          No completed giveaways yet. Finish and pay out a giveaway from its
          detail page, then return here to generate proof cards.
        </p>
        <p className="text-text-secondary text-sm">
          <Link
            to="/dashboard/giveaway"
            className="text-link hover:text-link-hover hover:underline"
          >
            ← All giveaways
          </Link>
        </p>
      </div>
    );
  }

  return (
    <ProofStudioLayout
      header={header}
      entitySelector={
        <ProofEntitySelector
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search title or id…"
          emptyMessage={
            filtered.length === 0
              ? "No giveaways match your search."
              : undefined
          }
        >
          {filtered.length > 0
            ? filtered.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(g.id);
                  }}
                  className={cn(
                    "hover:bg-surface-hover/80 motion-fast w-full rounded-lg border px-3 py-2.5 text-left",
                    selected?.id === g.id
                      ? "border-brand bg-surface-hover/40"
                      : "border-border bg-surface/50"
                  )}
                >
                  <p className="text-text line-clamp-2 text-sm font-medium">
                    {g.title}
                  </p>
                  <p className="text-text-secondary mt-0.5 line-clamp-1 text-xs">
                    {g.scopeSummaryLabel}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="text-[10px]">
                      {g.statusLabel}
                    </Badge>
                    <span className="text-text-secondary text-[11px]">
                      {g.winnerCount} winners · {g.satsPlanned.toLocaleString()}{" "}
                      sats
                    </span>
                  </div>
                  <p className="text-text-secondary mt-1 text-[10px]">
                    {g.completedAtLabel}
                  </p>
                </button>
              ))
            : null}
        </ProofEntitySelector>
      }
      preview={
        <ProofPreviewStage>
          {selected && payload ? (
            <div ref={cardRef} className="flex w-full justify-center">
              <ProofCardRenderer payload={payload} ratio={ratio} />
            </div>
          ) : (
            <p className="text-text-secondary text-sm">
              Select a giveaway to preview.
            </p>
          )}
        </ProofPreviewStage>
      }
      controlRail={
        selected && payload ? (
          <ProofCampaignControlRail
            selectedSummary={
              <div className="space-y-1">
                <p className="text-text line-clamp-2 text-sm font-medium">
                  {selected.title}
                </p>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-[10px]">
                    {selected.statusLabel}
                  </Badge>
                </div>
                <p className="text-text-secondary text-xs">
                  {selected.winnerCount} winners ·{" "}
                  {selected.satsPlanned.toLocaleString()} sats ·{" "}
                  {selected.completedAtLabel}
                </p>
              </div>
            }
            cardType={cardType}
            onCardTypeChange={setCardType}
            ratio={ratio}
            onRatioChange={setRatio}
            showLogo={showLogo}
            onShowLogoChange={setShowLogo}
            showReferenceId={showReferenceId}
            onShowReferenceIdChange={setShowReferenceId}
            showTimestamp={showTimestamp}
            onShowTimestampChange={setShowTimestamp}
            actionBar={
              <ProofActionBar
                cardRef={cardRef}
                payload={payload}
                ratio={ratio}
                openSourceHref={`/dashboard/giveaway/detail/${selected.id}`}
                openSourceLabel="Open giveaway"
              />
            }
          />
        ) : (
          <div className="text-text-secondary border-border rounded-xl border p-4 text-sm">
            Select a campaign to configure the card.
          </div>
        )
      }
    />
  );
}
