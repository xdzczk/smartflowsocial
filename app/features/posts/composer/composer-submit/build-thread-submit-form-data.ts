import type { SignedEvent } from "~/features/nostr/types";

import {
  ACTION_POST_TEXT,
  ACTION_SCHEDULE_TEXT,
} from "../components/composer/composer-submit-utils";
import {
  COMPOSER_SCHEDULE_FUTURE,
  COMPOSER_SCHEDULE_OR_QUEUE_REQUIRED,
} from "../components/composer/composer-validation";
import type {
  TextPostFormData,
  ThreadSegment,
} from "../hooks/composer-submit-types";

export type BuildThreadSubmitFormDataResult =
  | { ok: true; formData: FormData }
  | { ok: false; reason: string };

/**
 * Builds FormData for thread post/schedule (no side effects).
 */
export function buildThreadSubmitFormData(params: {
  segmentsToSubmit: ThreadSegment[];
  signedEvents: SignedEvent[];
  formData: TextPostFormData;
  actionSubmitType: string;
  threadSchedule?: {
    scheduledFirstUnix: number;
    nominalFirstUnix?: number;
  };
  queueTypeId?: string;
  threadDelayMinutes: number;
  relayOverride?: string[];
  embedContext?: string;
}): BuildThreadSubmitFormDataResult {
  const {
    segmentsToSubmit,
    signedEvents,
    formData,
    actionSubmitType,
    threadSchedule,
    queueTypeId,
    threadDelayMinutes,
    relayOverride,
    embedContext,
  } = params;

  const threadPayload = new FormData();
  threadPayload.set(
    "_action",
    actionSubmitType === ACTION_POST_TEXT ? "post-thread" : "schedule-thread"
  );
  threadPayload.set(
    "threadSegments",
    JSON.stringify(
      segmentsToSubmit.map((s) => ({
        content: s.content,
        attachmentMeta: s.attachments
          .filter((a) => a.url)
          .map((a) => ({
            localId: a.localId,
            url: a.url,
            alt: a.alt,
          })),
      }))
    )
  );
  threadPayload.set("threadSignedEvents", JSON.stringify(signedEvents));
  threadPayload.set("threadDelaySeconds", String(threadDelayMinutes * 60));
  threadPayload.set("queueType", formData.queueType);
  if (queueTypeId) threadPayload.set("queueTypeId", queueTypeId);
  if (formData.hashTagPresetId)
    threadPayload.set("hashTagPresetId", formData.hashTagPresetId);
  if (actionSubmitType === ACTION_SCHEDULE_TEXT) {
    if (!threadSchedule) {
      return { ok: false, reason: COMPOSER_SCHEDULE_OR_QUEUE_REQUIRED };
    }
    const unix = threadSchedule.scheduledFirstUnix;
    if (unix < Math.floor(Date.now() / 1000)) {
      return { ok: false, reason: COMPOSER_SCHEDULE_FUTURE };
    }
    threadPayload.set("scheduledFor", String(unix));
    if (
      threadSchedule.nominalFirstUnix != null &&
      threadSchedule.nominalFirstUnix !== unix
    ) {
      threadPayload.set(
        "nominalScheduledFor",
        String(threadSchedule.nominalFirstUnix)
      );
    }
  }
  if (relayOverride && relayOverride.length > 0)
    threadPayload.set("relays", JSON.stringify(relayOverride));
  if (embedContext) threadPayload.set("_embedContext", embedContext);
  threadPayload.set(
    "includeHashtagsInNoteBody",
    String(Boolean(formData.includeHashtagsInNoteBody))
  );
  return { ok: true, formData: threadPayload };
}
