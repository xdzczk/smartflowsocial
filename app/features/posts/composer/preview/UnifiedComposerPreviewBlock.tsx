import { useMemo } from "react";

import type { ComposerAttachment, QueueType } from "~/features/posts/types";
import { useOptionalUser } from "~/lib/remix-utils";

import { getQueueNextSlotLabel } from "../components/composer/composer-helpers";
import type { ComposerPublishMode } from "../components/composer/publish-mode";

import { buildPostThreadPreviewMetaLines } from "./build-preview-meta-lines";
import { ComposerPreviewSection } from "./ComposerPreviewSection";
import {
  computeHiddenTagsWarning,
  computePostPreviewWarnings,
  computeThreadPreviewWarnings,
} from "./compute-preview-warnings";
import { normalizePostPreviewFromComposer } from "./normalize-post-preview";
import {
  normalizeThreadPreviewFromComposer,
  parsePreviewTagLabels,
} from "./normalize-thread-preview";
import type { PreviewWarning } from "./normalized-composer-preview.types";
import { PreviewEmptyState } from "./PreviewEmptyState";
import { PreviewMetaRow } from "./PreviewMetaRow";
import { RenderedPostPreview } from "./RenderedPostPreview";
import { RenderedThreadPreview } from "./RenderedThreadPreview";
import { useEffectiveHashtagsForPreview } from "./useEffectiveHashtagsForPreview";

export interface UnifiedComposerPreviewBlockProps {
  isThreadMode: boolean;
  content: string;
  attachments: ComposerAttachment[];
  selectedHashtags: string;
  /** When true, preview tags match the tag field; when false, matches queue merge via API. */
  useHashtagPresets: boolean;
  queueTypes: Array<string | QueueType>;
  userId: string | undefined;
  /** Passed to `getEffectiveHashtagsForSubmit` fallback (same as submit). */
  defaultTags: string[];
  includeHashtagsInNoteBody: boolean;
  threadSegments: Array<{
    id: string;
    content: string;
    attachments: ComposerAttachment[];
  }>;
  threadDelayMinutes: number;
  publishMode: ComposerPublishMode;
  relayCount: number;
  selectedQueue: string;
  followUpSummaryLine: string;
  isRecyclable: boolean;
  /** Local datetime string for schedule mode (composer field). */
  scheduledForLocal?: string;
}

function postHasPreviewableContent(text: string, mediaCount: number): boolean {
  return text.trim().length > 0 || mediaCount > 0;
}

function threadHasPreviewableContent(
  segments: Array<{ content: string; attachments: ComposerAttachment[] }>
): boolean {
  return segments.some(
    (s) =>
      s.content.replace(/\s+/g, "").length > 0 ||
      s.attachments.some((a) => a.url)
  );
}

export function UnifiedComposerPreviewBlock(
  props: UnifiedComposerPreviewBlockProps
) {
  const user = useOptionalUser();
  const effectiveTagsLine = useEffectiveHashtagsForPreview({
    useHashtagPresets: props.useHashtagPresets,
    selectedHashtags: props.selectedHashtags,
    selectedQueue: props.selectedQueue,
    queueTypes: props.queueTypes,
    userId: props.userId,
    defaultTags: props.defaultTags,
  });

  const queueNextSlot = getQueueNextSlotLabel(
    props.scheduledForLocal?.trim() ?? ""
  );
  const scheduleLocalTrimmed = props.scheduledForLocal?.trim();
  const scheduleHint =
    props.publishMode === "schedule"
      ? scheduleLocalTrimmed && scheduleLocalTrimmed.length > 0
        ? scheduleLocalTrimmed
        : null
      : props.publishMode === "queue"
        ? queueNextSlot
        : null;

  const metaLines = useMemo(
    () =>
      buildPostThreadPreviewMetaLines({
        publishMode: props.publishMode,
        relayCount: props.relayCount,
        selectedQueue: props.selectedQueue,
        followUpSummaryLine: props.followUpSummaryLine,
        isRecyclable: props.isRecyclable,
        scheduleHint,
      }),
    [
      props.publishMode,
      props.relayCount,
      props.selectedQueue,
      props.followUpSummaryLine,
      props.isRecyclable,
      scheduleHint,
    ]
  );

  const postNormalized = useMemo(
    () =>
      normalizePostPreviewFromComposer({
        content: props.content,
        attachments: props.attachments,
        tagsLine: effectiveTagsLine,
        includeHashtagsInNoteBody: props.includeHashtagsInNoteBody !== false,
      }),
    [
      props.content,
      props.attachments,
      effectiveTagsLine,
      props.includeHashtagsInNoteBody,
    ]
  );

  const threadNormalized = useMemo(
    () =>
      normalizeThreadPreviewFromComposer({
        segments: props.threadSegments,
        cadenceMinutes: props.threadDelayMinutes,
      }),
    [props.threadSegments, props.threadDelayMinutes]
  );

  const threadWarnings = useMemo(() => {
    if (!props.isThreadMode) return [];
    const base = computeThreadPreviewWarnings({
      normalized: threadNormalized,
      rawSegments: props.threadSegments,
    });
    const hidden = computeHiddenTagsWarning(
      props.includeHashtagsInNoteBody === false,
      effectiveTagsLine
    );
    return hidden ? [...base, hidden] : base;
  }, [
    props.isThreadMode,
    threadNormalized,
    props.threadSegments,
    props.includeHashtagsInNoteBody,
    effectiveTagsLine,
  ]);

  const postWarnings: PreviewWarning[] = useMemo(() => {
    if (props.isThreadMode) return [];
    const base = computePostPreviewWarnings({ rawContent: props.content });
    const hidden = computeHiddenTagsWarning(
      props.includeHashtagsInNoteBody === false,
      effectiveTagsLine
    );
    return hidden ? [...base, hidden] : base;
  }, [
    props.isThreadMode,
    props.content,
    props.includeHashtagsInNoteBody,
    effectiveTagsLine,
  ]);

  if (props.isThreadMode) {
    const hasContent = threadHasPreviewableContent(props.threadSegments);
    const tagLabels = parsePreviewTagLabels(effectiveTagsLine);
    return (
      <ComposerPreviewSection title="Thread preview" warnings={threadWarnings}>
        {hasContent ? (
          <>
            <RenderedThreadPreview
              data={threadNormalized}
              user={user}
              tags={tagLabels}
              hideTags={props.includeHashtagsInNoteBody === false}
            />
            <PreviewMetaRow lines={metaLines} />
          </>
        ) : (
          <>
            <PreviewEmptyState message="Add thread segments to preview the full thread." />
            <PreviewMetaRow lines={metaLines} />
          </>
        )}
      </ComposerPreviewSection>
    );
  }

  const hasPost = postHasPreviewableContent(
    postNormalized.text,
    postNormalized.media.length
  );

  return (
    <ComposerPreviewSection title="Post preview" warnings={postWarnings}>
      {hasPost ? (
        <>
          <RenderedPostPreview data={postNormalized} user={user} />
          <PreviewMetaRow lines={metaLines} />
        </>
      ) : (
        <>
          <PreviewEmptyState message="Your post preview will appear here." />
          <PreviewMetaRow lines={metaLines} />
        </>
      )}
    </ComposerPreviewSection>
  );
}
