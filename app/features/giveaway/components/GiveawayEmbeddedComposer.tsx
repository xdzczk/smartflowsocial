import type { ContestEmbedPublishPayload } from "~/features/posts/composer";
import { parseNewPostLoaderData } from "~/features/posts/composer/components/NewPostPage";
import { UnifiedComposer } from "~/features/posts/composer/components/UnifiedComposer";
import { useNewPostState } from "~/features/posts/composer/hooks/useNewPostState";

type GiveawayLoaderLike = Record<string, unknown>;

const embedHint =
  "Compose your giveaway announcement; publish or schedule from the summary rail on the right.";

export function GiveawayEmbeddedComposer({
  loaderData,
  composerKey,
  onEmbedPublishSuccess,
  contestRailLaunchMode,
  contestRailScheduledFor,
  onEmbedActionsReady,
}: {
  loaderData: GiveawayLoaderLike;
  composerKey: number;
  onEmbedPublishSuccess: (payload: ContestEmbedPublishPayload) => void;
  contestRailLaunchMode: "now" | "schedule";
  contestRailScheduledFor: string;
  onEmbedActionsReady?: (api: {
    publishNow: () => void;
    schedulePost: () => void;
  }) => void;
}) {
  const parsed = parseNewPostLoaderData(loaderData);
  const {
    handleQueueTypeChange,
    handleHashtagPresetSelect,
    selectedHashTagPresetId,
  } = useNewPostState();

  return (
    <div className="min-w-0 space-y-2">
      <p className="text-text-secondary text-xs">{embedHint}</p>
      <UnifiedComposer
        key={composerKey}
        queueTypes={parsed.typedQueueTypes}
        hashTagPresets={parsed.typedHashTagPresets}
        scheduleIntervals={
          parsed.scheduleIntervals.length > 0
            ? parsed.scheduleIntervals
            : undefined
        }
        onQueueTypeChange={handleQueueTypeChange}
        selectedHashTagPresetId={selectedHashTagPresetId}
        onHashtagPresetChange={(presetId, hashtags) =>
          handleHashtagPresetSelect(presetId ?? "", hashtags)
        }
        relayCount={parsed.defaultRelays.length}
        formAction="/dashboard/compose?type=post"
        localDraftStorageKey="composer-giveaway-embedded-draft"
        embedContext="contest"
        embeddedDensity="source-post"
        contestRailLaunchMode={contestRailLaunchMode}
        contestRailScheduledFor={
          contestRailLaunchMode === "schedule" ? contestRailScheduledFor : null
        }
        onEmbedActionsReady={onEmbedActionsReady}
        onEmbedPublishSuccess={onEmbedPublishSuccess}
        skipLocalDraftRestore={false}
        suppressBuiltInDraftPicker
      />
    </div>
  );
}
