import { useMemo } from "react";

import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import { useOptionalUser } from "~/lib/remix-utils";

import type { ComposerPublishMode } from "../components/composer/publish-mode";

import { ComposerPreviewSection } from "./ComposerPreviewSection";
import {
  computeHiddenTagsWarning,
  computePollPreviewWarnings,
} from "./compute-preview-warnings";
import { normalizePollPreviewFromComposer } from "./normalize-poll-preview";
import type { PollEndMode } from "./poll-preview-end-label";
import { PreviewArtifactShell } from "./PreviewArtifactShell";
import { PreviewEmptyState } from "./PreviewEmptyState";
import { RenderedPollPreview } from "./RenderedPollPreview";

export interface PollComposerPreviewBlockProps {
  question: string;
  options: string[];
  /** Stable ids aligned with `options` (same length). */
  optionRowIds: string[];
  pollType: "singlechoice" | "multiplechoice";
  tagsLine: string;
  includeHashtagsInNoteBody: boolean;
  pollEndMode: PollEndMode;
  endsAtLocal: string;
  pollEndHoursAfterPublish: number;
  publishMode: ComposerPublishMode;
  scheduledFor: string;
  userTimezone: string;
}

export function PollComposerPreviewBlock(props: PollComposerPreviewBlockProps) {
  const user = useOptionalUser();
  const { userTimeFormat } = useFormattedDate();

  const optionKeysForPreview = useMemo(() => {
    const keys: string[] = [];
    for (let i = 0; i < props.options.length; i++) {
      const t = props.options[i]!.trim();
      if (t.length === 0) continue;
      keys.push(props.optionRowIds[i] ?? `opt-${i}`);
    }
    return keys;
  }, [props.options, props.optionRowIds]);

  const normalized = useMemo(
    () =>
      normalizePollPreviewFromComposer({
        question: props.question,
        options: props.options,
        pollType: props.pollType,
        tagsLine: props.tagsLine,
        includeHashtagsInNoteBody: props.includeHashtagsInNoteBody !== false,
        end: {
          pollEndMode: props.pollEndMode,
          endsAtLocal: props.endsAtLocal,
          pollEndHoursAfterPublish: props.pollEndHoursAfterPublish,
          publishMode: props.publishMode,
          scheduledFor: props.scheduledFor,
          userTimezone: props.userTimezone,
          userTimeFormat,
        },
      }),
    [
      props.question,
      props.options,
      props.pollType,
      props.tagsLine,
      props.includeHashtagsInNoteBody,
      props.pollEndMode,
      props.endsAtLocal,
      props.pollEndHoursAfterPublish,
      props.publishMode,
      props.scheduledFor,
      props.userTimezone,
      userTimeFormat,
    ]
  );

  const warnings = useMemo(() => {
    const w = computePollPreviewWarnings(normalized, props.options);
    const h = computeHiddenTagsWarning(
      props.includeHashtagsInNoteBody === false,
      props.tagsLine
    );
    return h ? [...w, h] : w;
  }, [
    normalized,
    props.options,
    props.includeHashtagsInNoteBody,
    props.tagsLine,
  ]);

  const hasPreview =
    normalized.question.trim().length > 0 && normalized.options.length >= 2;

  return (
    <ComposerPreviewSection title="Poll preview" warnings={warnings}>
      <PreviewArtifactShell>
        {hasPreview ? (
          <RenderedPollPreview
            data={normalized}
            user={user}
            optionKeys={optionKeysForPreview}
          />
        ) : (
          <PreviewEmptyState
            className="border-0 bg-transparent py-5"
            message="Add a question and at least 2 options to preview your poll."
          />
        )}
      </PreviewArtifactShell>
    </ComposerPreviewSection>
  );
}
