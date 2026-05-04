import { Link } from "@remix-run/react";
import { useMemo, useRef, useState } from "react";

import { Badge } from "~/components/ui/badge";
import type { ProofRatio } from "~/lib/proof";
import {
  buildContestProofPayload,
  type ContestProofStudioDto,
} from "~/lib/proof/adapters/contest";
import { cn } from "~/lib/utils";

import { ProofActionBar } from "../components/ProofActionBar";
import { ProofCampaignControlRail } from "../components/ProofCampaignControlRail";
import { ProofCardRenderer } from "../components/ProofCardRenderer";
import { ProofEntitySelector } from "../components/ProofEntitySelector";
import { ProofPreviewStage } from "../components/ProofPreviewStage";
import { ProofStudioLayout } from "../components/ProofStudioLayout";

type CampaignCardType = "public-summary" | "fairness-proof" | "receipt";

export function ContestProofStudio({
  contests,
}: {
  contests: ContestProofStudioDto[];
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
    if (!q) return contests;
    return contests.filter(
      (c) => c.title.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
    );
  }, [contests, search]);

  const selected = useMemo(() => {
    const pool = filtered.length > 0 ? filtered : contests;
    const byId = pool.find((c) => c.id === selectedId);
    if (byId) return byId;
    return pool[0] ?? null;
  }, [filtered, contests, selectedId]);

  const payload = useMemo(() => {
    if (!selected) return null;
    return buildContestProofPayload(selected, cardType, ratio, {
      showLogo,
      showReferenceId,
      showTimestamp,
    });
  }, [selected, cardType, ratio, showLogo, showReferenceId, showTimestamp]);

  const header = (
    <div>
      <h1 className="text-text text-2xl font-semibold">Proof Studio</h1>
      <p className="text-text-secondary mt-1 max-w-2xl text-sm">
        Create shareable proof cards for completed contests - preview, switch
        templates, and export PNGs.
      </p>
    </div>
  );

  if (contests.length === 0) {
    return (
      <div className="space-y-6">
        {header}
        <p className="text-text-secondary text-sm">
          No completed contests yet. Mark a contest complete from its detail
          page, then return here.
        </p>
        <p className="text-text-secondary text-sm">
          <Link
            to="/dashboard/contests"
            className="text-link hover:text-link-hover hover:underline"
          >
            ← All contests
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
            filtered.length === 0 ? "No contests match your search." : undefined
          }
        >
          {filtered.length > 0
            ? filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(c.id);
                  }}
                  className={cn(
                    "hover:bg-surface-hover/80 motion-fast w-full rounded-lg border px-3 py-2.5 text-left",
                    selected?.id === c.id
                      ? "border-brand bg-surface-hover/40"
                      : "border-border bg-surface/50"
                  )}
                >
                  <p className="text-text line-clamp-2 text-sm font-medium">
                    {c.title}
                  </p>
                  <p className="text-text-secondary mt-0.5 line-clamp-1 text-xs">
                    {c.rankingMetric.toLowerCase()} · {c.durationLabel}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="text-[10px]">
                      {c.statusLabel}
                    </Badge>
                    <span className="text-text-secondary text-[11px]">
                      {c.winnerCount} winners · {c.satsPlanned.toLocaleString()}{" "}
                      sats
                    </span>
                  </div>
                  <p className="text-text-secondary mt-1 text-[10px]">
                    {c.completedAtLabel}
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
              Select a contest to preview.
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
                openSourceHref={`/dashboard/contests/detail/${selected.id}`}
                openSourceLabel="Open contest"
              />
            }
          />
        ) : (
          <div className="text-text-secondary border-border rounded-xl border p-4 text-sm">
            Select a contest to configure the card.
          </div>
        )
      }
    />
  );
}
