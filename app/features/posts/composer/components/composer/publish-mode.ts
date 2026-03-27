import {
  ACTION_POST_POLL,
  ACTION_POST_TEXT,
  ACTION_SCHEDULE_POLL,
  ACTION_SCHEDULE_TEXT,
} from "./composer-submit-utils";

export type ComposerPublishMode = "now" | "schedule" | "queue";

export interface ComposerValidationState {
  blockers: string[];
  warnings: string[];
  info: string[];
  ready: boolean;
}

export function getTextSubmitActionForMode(mode: ComposerPublishMode): string {
  if (mode === "now") return ACTION_POST_TEXT;
  return ACTION_SCHEDULE_TEXT;
}

export function getPollSubmitActionForMode(mode: ComposerPublishMode): string {
  if (mode === "now") return ACTION_POST_POLL;
  return ACTION_SCHEDULE_POLL;
}

export function getPrimaryCtaLabelForMode(
  mode: ComposerPublishMode,
  _entity: "post" | "poll" | "thread" | "article"
): string {
  void _entity;
  if (mode === "queue") return "Add to queue";
  if (mode === "schedule") return "Schedule post";
  return "Publish now";
}

/** Primary button label while submit/signing is in flight. */
export function getPrimaryCtaPendingLabelForMode(
  mode: ComposerPublishMode,
  _entity: "post" | "poll" | "thread" | "article"
): string {
  void _entity;
  if (mode === "queue") return "Adding to queue…";
  if (mode === "schedule") return "Scheduling…";
  return "Publishing…";
}
