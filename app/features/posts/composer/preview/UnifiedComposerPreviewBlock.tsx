import { useMemo } from "react";

import type { ComposerAttachment, QueueType } from "~/features/posts/types";
import { useOptionalUser } from "~/lib/remix-utils";

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
import { PreviewArtifactShell } from "./PreviewArtifactShell";
import { PreviewEmptyState } from "./PreviewEmptyState";
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
  selectedQueue: string;
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
        <PreviewArtifactShell>
          {hasContent ? (
            <RenderedThreadPreview
              data={threadNormalized}
              user={user}
              tags={tagLabels}
              hideTags={props.includeHashtagsInNoteBody === false}
            />
          ) : (
            <PreviewEmptyState
              className="border-0 bg-transparent py-5"
              message="Add thread segments to preview the full thread."
            />
          )}
        </PreviewArtifactShell>
      </ComposerPreviewSection>
    );
  }

  const hasPost = postHasPreviewableContent(
    postNormalized.text,
    postNormalized.media.length
  );

  return (
    <ComposerPreviewSection title="Post preview" warnings={postWarnings}>
      <PreviewArtifactShell>
        {hasPost ? (
          <RenderedPostPreview data={postNormalized} user={user} />
        ) : (
          <PreviewEmptyState
            className="border-0 bg-transparent py-5"
            message="Your post preview will appear here."
          />
        )}
      </PreviewArtifactShell>
    </ComposerPreviewSection>
  );
}
