import { nip19 } from "nostr-tools";
import { useMemo, useState } from "react";

import { ActionRail } from "~/components/action-rail/ActionRail";
import { Button } from "~/components/ui/button";
import {
  RAIL_PAD_X,
  RAIL_ZONE_PY,
  RailSectionHeader,
  RailSettingsValueRow,
} from "~/features/posts/components/publishing-rail";
import type { SearchLookupResolution } from "~/features/search";
import type { NostrClientConfig } from "~/lib/nostr-client-urls";

import { LookupEngageNowSection } from "./lookup-engage/LookupEngageNowSection";
import { LookupCopySection } from "./LookupCopySection";
import { LookupPrimaryActions } from "./LookupPrimaryActions";
import type { SearchStatsShape } from "./MetricsBand";
import type { ResolvedPostCardData } from "./ResolvedPostCard";

function truncateMiddle(s: string, head = 10, tail = 8): string {
  if (s.length <= head + tail + 3) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

export interface LookupInspectorRailProps {
  result: ResolvedPostCardData;
  stats: SearchStatsShape | null;
  resolution: SearchLookupResolution | null;
  nostrClientConfig: NostrClientConfig;
  viewEventLabel: string;
  onScheduleQuote: () => void;
  onScheduleRepost: () => void;
  noteOrNeventDisplay: string | null;
  publishRelays: string[];
  className?: string;
}

export function LookupInspectorRail({
  result,
  stats,
  resolution,
  nostrClientConfig,
  viewEventLabel,
  onScheduleQuote,
  onScheduleRepost,
  noteOrNeventDisplay,
  publishRelays,
  className,
}: LookupInspectorRailProps) {
  const [idExpanded, setIdExpanded] = useState(false);

  const npub = useMemo(() => {
    try {
      return nip19.npubEncode(result.pubkey);
    } catch {
      return result.pubkey;
    }
  }, [result.pubkey]);

  const idShown = idExpanded ? result.id : truncateMiddle(result.id, 12, 10);
  const topReplies = resolution?.topLevelReplyCount ?? 0;

  return (
    <ActionRail
      ariaLabel="Lookup inspector"
      className={className}
      footer={null}
    >
      <div className={`${RAIL_PAD_X} ${RAIL_ZONE_PY} space-y-1`}>
        <RailSectionHeader>Engage now</RailSectionHeader>
        <LookupEngageNowSection
          eventId={result.id}
          authorPubkey={result.pubkey}
          authorDisplayName={result.authorName}
          publishRelays={publishRelays}
        />
      </div>

      <div
        className={`${RAIL_PAD_X} ${RAIL_ZONE_PY} border-border space-y-1 border-t`}
      >
        <RailSectionHeader>Actions</RailSectionHeader>
        <LookupPrimaryActions
          onScheduleQuote={onScheduleQuote}
          onScheduleRepost={onScheduleRepost}
        />
      </div>

      <div
        className={`${RAIL_PAD_X} ${RAIL_ZONE_PY} border-border space-y-2 border-t`}
      >
        <RailSectionHeader>Copy</RailSectionHeader>
        <LookupCopySection
          result={result}
          nostrClientConfig={nostrClientConfig}
          viewEventLabel={viewEventLabel}
          noteOrNeventDisplay={noteOrNeventDisplay}
        />
      </div>

      <div className={`${RAIL_PAD_X} ${RAIL_ZONE_PY} border-border border-t`}>
        <RailSectionHeader>Entity</RailSectionHeader>
        <div className="space-y-0">
          <RailSettingsValueRow label="Type" value="Post" trailing={null} />
          <RailSettingsValueRow
            label="Kind"
            value={String(result.kind)}
            trailing={null}
          />
          <RailSettingsValueRow
            label="Author"
            value={result.authorName.trim() || truncateMiddle(npub, 8, 6)}
            trailing={null}
          />
          <RailSettingsValueRow
            label="Published"
            value={new Date(result.created_at * 1000).toLocaleString()}
            trailing={null}
          />
          <div className="flex items-start justify-between gap-2 py-1.5">
            <span className="text-muted-foreground shrink-0 text-xs">
              Event ID
            </span>
            <div className="min-w-0 text-right">
              <code className="font-mono text-[11px] break-all">{idShown}</code>
              <Button
                type="button"
                variant="link"
                className="text-muted-foreground h-auto p-0 pl-2 text-[11px]"
                onClick={() => setIdExpanded((v) => !v)}
              >
                {idExpanded ? "Short" : "Full"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className={`${RAIL_PAD_X} ${RAIL_ZONE_PY} border-border border-t`}>
        <RailSectionHeader>Thread / load</RailSectionHeader>
        <p className="text-foreground text-xs font-medium">
          Top-level replies loaded: {topReplies}
        </p>
        <p className="text-muted-foreground mt-1 text-xs leading-snug">
          Nested replies load on demand.
        </p>
        {resolution?.threadPartial ? (
          <p className="text-muted-foreground mt-2 text-xs">
            Thread data may be incomplete (timeout or limited relay data).
          </p>
        ) : null}
        {resolution?.statsUnavailable ? (
          <p className="text-muted-foreground mt-1 text-xs">
            Engagement stats could not be loaded.
          </p>
        ) : null}
        {stats ? (
          <p className="text-muted-foreground mt-2 text-[11px]">
            Counters reflect index/cache when available.
          </p>
        ) : null}
      </div>
    </ActionRail>
  );
}
