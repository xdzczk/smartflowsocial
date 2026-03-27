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
  entity: "post" | "poll" | "thread" | "article"
): string {
  if (mode === "queue") {
    if (entity === "thread") return "Add thread to queue";
    if (entity === "article") return "Add article to queue";
    return "Add to queue";
  }
  if (mode === "schedule") {
    if (entity === "thread") return "Schedule thread";
    if (entity === "article") return "Schedule article";
    return "Schedule post";
  }
  if (entity === "poll") return "Publish poll now";
  if (entity === "thread") return "Publish thread now";
  if (entity === "article") return "Publish article";
  return "Publish now";
}

/** Primary button label while submit/signing is in flight. */
export function getPrimaryCtaPendingLabelForMode(
  mode: ComposerPublishMode,
  entity: "post" | "poll" | "thread" | "article"
): string {
  if (mode === "queue") {
    if (entity === "thread") return "Adding thread to queue…";
    if (entity === "article") return "Adding article to queue…";
    return "Adding to queue…";
  }
  if (mode === "schedule") {
    if (entity === "thread") return "Scheduling thread…";
    if (entity === "article") return "Scheduling article…";
    return "Scheduling…";
  }
  if (entity === "poll") return "Publishing poll…";
  if (entity === "thread") return "Publishing thread…";
  if (entity === "article") return "Publishing article…";
  return "Publishing…";
}
