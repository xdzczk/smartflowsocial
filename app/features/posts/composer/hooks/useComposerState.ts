/**
 * Composer state for status pill and button states.
 * States: idle/editing -> ready -> signing -> publishing -> success | failed
 */

import { useMemo } from "react";

import type { ComposerStatus } from "~/features/posts/components/NewPostHeader";

export interface ComposerStateInput {
  /** Has meaningful content (text or attachments) */
  hasContent: boolean;
  /** Blocking validation: uploads in progress or failed attachments */
  canSubmit: boolean;
  /** User selected a schedule time (schedule mode) */
  hasScheduleTime: boolean;
  /** Currently waiting for signer */
  isSigning: boolean;
  /** Fetcher is submitting (post/schedule/draft) */
  isSubmitting: boolean;
  /** Current submit is publish/schedule (not draft) */
  publishSubmitInFlight: boolean;
  /** Last publish/schedule failed (fetcher returned error) */
  lastPublishFailed: boolean;
}

function deriveStatus(input: ComposerStateInput): ComposerStatus {
  if (input.isSigning) return "Signing…";
  if (input.lastPublishFailed) return "Failed";
  if (input.publishSubmitInFlight && input.isSubmitting) return "Publishing…";
  if (input.hasContent && input.canSubmit) {
    return input.hasScheduleTime ? "Scheduled" : "Ready";
  }
  return "Draft";
}

export function useComposerState(input: ComposerStateInput): ComposerStatus {
  return useMemo(() => deriveStatus(input), [input]);
}
