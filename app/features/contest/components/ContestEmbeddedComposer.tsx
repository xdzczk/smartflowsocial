import {
  UnifiedComposer,
  type ContestEmbedPublishPayload,
} from "~/features/posts/composer";
import { parseNewPostLoaderData } from "~/features/posts/composer/components/NewPostPage";
import { useNewPostState } from "~/features/posts/composer/hooks/useNewPostState";

type ContestLoaderLike = Record<string, unknown>;

export function ContestEmbeddedComposer({
  loaderData,
  composerKey,
  onEmbedPublishSuccess,
}: {
  loaderData: ContestLoaderLike;
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
    <div className="border-border bg-muted/20 rounded-lg border p-4">
      <p className="text-muted-foreground mb-3 text-sm font-medium">
        Write and publish your contest post
      </p>
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
        formAction="/dashboard/newpost"
        localDraftStorageKey="composer-contest-embedded-draft"
        embedContext="contest"
        onEmbedPublishSuccess={onEmbedPublishSuccess}
        skipLocalDraftRestore={false}
      />
    </div>
  );
}
