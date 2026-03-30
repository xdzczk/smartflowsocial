import type { ContestEmbedPublishPayload } from "~/features/posts/composer";
import { parseNewPostLoaderData } from "~/features/posts/composer/components/NewPostPage";
import { UnifiedComposer } from "~/features/posts/composer/components/UnifiedComposer";
import { useNewPostState } from "~/features/posts/composer/hooks/useNewPostState";

type GiveawayLoaderLike = Record<string, unknown>;

const embedHint =
  "Compose your giveaway announcement, then publish — entries count on this note only.";

export function GiveawayEmbeddedComposer({
  loaderData,
  composerKey,
  onEmbedPublishSuccess,
}: {
  loaderData: GiveawayLoaderLike;
  composerKey: number;
  onEmbedPublishSuccess: (payload: ContestEmbedPublishPayload) => void;
}) {
  const parsed = parseNewPostLoaderData(loaderData);
  const {
    handleQueueTypeChange,
    handleHashtagPresetSelect,
    selectedHashTagPresetId,
  } = useNewPostState();

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs">{embedHint}</p>
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
        embeddedDensity="full"
        contestRailLaunchMode="now"
        contestRailScheduledFor={null}
        onEmbedPublishSuccess={onEmbedPublishSuccess}
        skipLocalDraftRestore={false}
        suppressBuiltInDraftPicker
      />
    </div>
  );
}
