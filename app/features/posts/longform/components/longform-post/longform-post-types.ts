import type { ComposerContext } from "~/features/posts/composer";
import type { ComposerPublishMode } from "~/features/posts/composer/components/composer";

export interface LongFormQueueType {
  id?: string;
  name: string;
  color?: string | null;
  hashtags?: string | null;
  scheduleType?: string;
  scheduleConfig?: unknown;
  isEnabled?: boolean;
  includeHashtagsInNoteBody?: boolean;
}

export interface LongFormHashTagPreset {
  id: string;
  name: string;
  tags: string;
  description?: string | null;
}

export interface LongFormInitialData {
  id?: string;
  title?: string;
  summary?: string;
  content?: string;
  image?: string;
  tags?: string[];
  queueType?: { name: string };
}

export interface LongFormPostProps {
  queueTypes?: Array<string | LongFormQueueType>;
  scheduleIntervals?: number[];
  userTags?: string;
  uploadProvider?: string | null;
  userTimezone?: string;
  onQueueTypeChange?: (name: string) => void;
  onPreview?: (data: {
    title: string;
    summary: string;
    content: string;
    image: string;
  }) => void;
  initialData?: LongFormInitialData | null;
  isEditing?: boolean;
  hashTagPresets?: LongFormHashTagPreset[];
  useHashtagPresets?: boolean;
  selectedHashtagPresetId?: string | null;
  selectedHashtags?: string;
  onUseHashtagPresetsChange?: (value: boolean) => void;
  onHashtagPresetChange?: (presetId: string | null, hashtags: string) => void;
  /** When "template", only "Save as template" and Cancel are shown. */
  mode?: "default" | "template";
  /** When set with mode="template", submit uses updateTemplateLongform instead of createTemplate. */
  editTemplateContext?: { templateId: string; longFormPostId: string } | null;
  /** When editing a template, pass the current template name to prefill the composer field. */
  initialTemplateName?: string | null;
  /** Prefill schedule (datetime-local format YYYY-MM-DDTHH:mm) when opening from calendar slot. */
  initialScheduledFor?: string | null;
  /** When true, skip restoring local browser draft and clear any cached snapshot. */
  skipLocalDraftRestore?: boolean;
  publishMode?: ComposerPublishMode;
  onPublishModeChange?: (next: ComposerPublishMode) => void;
  onDraftStateLabelChange?: (label: string) => void;
  /** Default relays from loader (count + relay modal seed). */
  defaultRelays?: string[];
  /** When user saved a custom set from the relay modal. */
  relayOverride?: string[];
  /** Opens relay selector (parent owns `RelaySelectorModal`). */
  onRelayClick?: () => void;
  /** Template edit: preformatted updated line for template rail */
  templateLastUpdatedLabel?: string | null;
  /** Template edit: parent opens delete confirmation */
  onTemplateDeleteClick?: () => void;
  /**
   * Fires immediately when the user commits a "Publish now" action, before
   * signing or network work. Used by the parent page to open publish progress
   * UI right away.
   */
  onPublishIntent?: () => void;
  /**
   * Route loader context. When not `create` (e.g. `edit_scheduled`), the right rail
   * uses "Save changes" like the short-form composer.
   */
  composerContext?: ComposerContext;
}
