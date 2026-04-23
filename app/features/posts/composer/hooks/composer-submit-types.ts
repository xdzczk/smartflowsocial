import type { FetcherWithComponents } from "@remix-run/react";
import type { UseFormReturn } from "react-hook-form";
import type { z } from "zod";

import type { textPostClientSchema } from "~/lib/validation";

import type {
  QueueType,
  ComposerAttachment,
  RepostConditions,
} from "../../types";
import type { ComposerPublishMode } from "../components/composer/publish-mode";
import type { ComposerContext } from "../services/compose-route-contract";

export type TextPostFormData = z.infer<typeof textPostClientSchema>;

export interface ThreadSegment {
  id: string;
  content: string;
  attachments: ComposerAttachment[];
}

export interface UseComposerSubmitOptions {
  form: UseFormReturn<TextPostFormData>;
  fetcher: FetcherWithComponents<unknown>;
  setPublishSubmitInFlight: (v: boolean) => void;
  setLastPublishFailed: (v: boolean) => void;
  /** Template mode: save-as-template flow */
  isTemplateMode: boolean;
  templateName: string;
  editTemplateContext: { templateId: string; postId: string } | null;
  clearLocalSnapshot: () => void;
  attachments: ComposerAttachment[];
  initialAttachmentMeta?: Array<{
    localId: string;
    url: string;
    alt?: string;
  }>;
  selectedHashtags: string;
  selectedQueue: string;
  queueTypeId: string | null;
  queueTypes: Array<string | QueueType>;
  initialDraftId: string | null;
  relayOverride?: string[];
  scheduleRandomWindowMinutes: number;
  alsoScheduleRepost: boolean;
  repostDelayList: Array<{
    id: string;
    value: number;
    unit: "hours" | "minutes";
  }>;
  repostConditions: RepostConditions | null;
  alsoScheduleQuote: boolean;
  quoteEntries: Array<{
    id: string;
    value: number;
    unit: "hours" | "minutes";
    caption: string;
  }>;
  isThreadMode: boolean;
  threadSegments: ThreadSegment[];
  threadDelayMinutes: number;
  user: {
    id?: string;
    timezone?: string;
  } | null;
  defaultTags?: string[];
  /** When set, all fetcher.submit calls POST to this path (e.g. `/dashboard/compose?type=post` when composer is embedded). */
  submitAction?: string;
  /** Sent as `_embedContext` so the newpost action can return JSON instead of redirects. */
  embedContext?: "contest";
  /** Delivery mode: queue uses API-derived slot when `scheduledFor` is empty. */
  publishMode?: ComposerPublishMode;
  /** From `usePostScheduling`; used to resolve queue slot at submit when mode is queue. */
  calculateQueueScheduleTime?: (queueName: string) => Promise<string | null>;
  /** Fires when the user submits a server draft save (`save-draft` / `draft-text`). */
  onBeginSaveDraft?: () => void;
  /**
   * Fires immediately when the user commits a "Publish now" action — before
   * signing or any async work. Used to open the publish progress modal early
   * so the user never waits on the button spinner alone.
   */
  onPublishIntent?: () => void;
  composerContext?: ComposerContext;
}
