/**
 * Nostr inspector body: resolution context, post card, metrics, thread, technical details,
 * and sticky action rail (desktop) / inline primary actions (mobile).
 */

import { useRouteLoaderData } from "@remix-run/react";
import { nip19 } from "nostr-tools";
import { useMemo, type ReactNode } from "react";

import type { SearchLookupResolution } from "~/features/search";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import {
  getNostrClientConfig,
  getNostrClientDisplayName,
} from "~/lib/nostr-client-urls";
import { DEFAULT_ZAP_AMOUNT_SATS_FALLBACK } from "~/lib/zap-defaults";

import { LookupEngageNowSection } from "./lookup-engage/LookupEngageNowSection";
import { LookupCopySection } from "./LookupCopySection";
import { LookupInspectorRail } from "./LookupInspectorRail";
import { LookupPrimaryActions } from "./LookupPrimaryActions";
import { LookupResultHeader } from "./LookupResultHeader";
import { MetricsBand, type SearchStatsShape } from "./MetricsBand";
import { ResolvedPostCard } from "./ResolvedPostCard";
import type { SearchReplyItem } from "./SearchReplyThread";
import { TechnicalDetailsCollapsible } from "./TechnicalDetailsCollapsible";
import { ThreadExplorer } from "./ThreadExplorer";

interface SearchResultData {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  content: string;
  tags: string[][];
  authorName: string;
  authorImage: string | null;
  mediaUrls: string[];
}

interface SearchResultProps {
  result: SearchResultData;
  stats: SearchStatsShape | null;
  replies: SearchReplyItem[];
  resolution: SearchLookupResolution | null;
  queryLabel?: string | null;
  onClear: () => void;
  onScheduleQuote: () => void;
  onScheduleRepost: () => void;
  onRetryLookup?: () => void;
  /** Effective publish relays for client-side tag hints and zap flow. */
  publishRelays?: string[];
  /** Resolved default zap (sats); usually from root session user. */
  defaultZapAmountSats?: number;
}

function MobileRailCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="border-border bg-card rounded-xl border p-4 shadow-sm">
      <p className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
        {title}
      </p>
      {children}
    </div>
  );
}

export function SearchResult({
  result,
  stats,
  replies,
  resolution,
  queryLabel,
  onClear,
  onScheduleQuote,
  onScheduleRepost,
  onRetryLookup,
  publishRelays = [],
  defaultZapAmountSats: defaultZapAmountSatsProp,
}: SearchResultProps) {
  const { formatDate } = useFormattedDate();
  const rootData = useRouteLoaderData("root") as
    | {
        user?: {
          preferredNostrClient?: string;
          customNostrClientBaseUrl?: string | null;
          defaultZapAmountSats?: number | null;
        } | null;
      }
    | undefined;

  const defaultZapAmountSats =
    typeof defaultZapAmountSatsProp === "number" &&
    Number.isInteger(defaultZapAmountSatsProp) &&
    defaultZapAmountSatsProp >= 1
      ? defaultZapAmountSatsProp
      : typeof rootData?.user?.defaultZapAmountSats === "number" &&
          Number.isInteger(rootData.user.defaultZapAmountSats) &&
          rootData.user.defaultZapAmountSats >= 1
        ? rootData.user.defaultZapAmountSats
        : DEFAULT_ZAP_AMOUNT_SATS_FALLBACK;
  const nostrClientConfig = useMemo(
    () =>
      getNostrClientConfig(
        rootData?.user?.preferredNostrClient,
        rootData?.user?.customNostrClientBaseUrl
      ),
    [
      rootData?.user?.preferredNostrClient,
      rootData?.user?.customNostrClientBaseUrl,
    ]
  );
  const viewEventLabel = getNostrClientDisplayName(
    rootData?.user?.preferredNostrClient
  );

  const noteOrNeventDisplay = useMemo(() => {
    const kind = resolution?.identifierKind ?? "hex";
    try {
      if (kind === "nevent") {
        return nip19.neventEncode({ id: result.id });
      }
      return nip19.noteEncode(result.id);
    } catch {
      return null;
    }
  }, [resolution?.identifierKind, result.id]);

  return (
    <div className="space-y-6">
      <LookupResultHeader
        result={result}
        resolution={resolution}
        queryLabel={queryLabel}
        onNewLookup={onClear}
        onRetry={onRetryLookup}
      />

      <div className="space-y-4 lg:hidden">
        <MobileRailCard title="Engage now">
          <LookupEngageNowSection
            eventId={result.id}
            authorPubkey={result.pubkey}
            authorDisplayName={result.authorName}
            publishRelays={publishRelays}
            defaultZapAmountSats={defaultZapAmountSats}
          />
        </MobileRailCard>
        <MobileRailCard title="Actions">
          <LookupPrimaryActions
            onScheduleQuote={onScheduleQuote}
            onScheduleRepost={onScheduleRepost}
          />
        </MobileRailCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="min-w-0 space-y-6">
          <ResolvedPostCard
            result={result}
            nostrClientConfig={nostrClientConfig}
            viewEventLabel={viewEventLabel}
          />
          {stats ? (
            <MetricsBand
              stats={stats}
              statsUnavailable={resolution?.statsUnavailable}
            />
          ) : resolution?.statsUnavailable ? (
            <MetricsBand
              stats={{
                likes: 0,
                replies: 0,
                mentions: 0,
                reposts: 0,
                zaps: 0,
                satszapped: 0,
              }}
              statsUnavailable
            />
          ) : null}
          <ThreadExplorer
            replies={replies}
            nostrClientConfig={nostrClientConfig}
            formatDate={formatDate}
            topLevelCount={resolution?.topLevelReplyCount}
          />
          <div className="lg:hidden">
            <MobileRailCard title="Copy">
              <LookupCopySection
                result={result}
                nostrClientConfig={nostrClientConfig}
                viewEventLabel={viewEventLabel}
                noteOrNeventDisplay={noteOrNeventDisplay}
              />
            </MobileRailCard>
          </div>
          <TechnicalDetailsCollapsible
            eventId={result.id}
            pubkey={result.pubkey}
            kind={result.kind}
            createdAtUnix={result.created_at}
            tags={result.tags}
            noteOrNevent={noteOrNeventDisplay}
          />
        </div>

        <aside className="hidden min-w-0 lg:block">
          <LookupInspectorRail
            className="lg:top-[5.5rem] lg:max-h-[calc(100vh-6.5rem)] lg:w-[320px] xl:w-[320px]"
            result={result}
            stats={stats}
            resolution={resolution}
            nostrClientConfig={nostrClientConfig}
            viewEventLabel={viewEventLabel}
            onScheduleQuote={onScheduleQuote}
            onScheduleRepost={onScheduleRepost}
            noteOrNeventDisplay={noteOrNeventDisplay}
            publishRelays={publishRelays}
            defaultZapAmountSats={defaultZapAmountSats}
          />
        </aside>
      </div>
    </div>
  );
}
