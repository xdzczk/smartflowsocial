import {
  ACTION_POST_POLL,
  ACTION_POST_TEXT,
  ACTION_SCHEDULE_POLL,
  ACTION_SCHEDULE_TEXT,
} from "./composer-submit-utils";

export type ComposerPublishMode = "now" | "schedule" | "queue" | "draft";

export interface ComposerValidationState {
  blockers: string[];
  warnings: string[];
  info: string[];
  ready: boolean;
}

export function getTextSubmitActionForMode(mode: ComposerPublishMode): string {
  if (mode === "draft") return "draft-text";
  if (mode === "now") return ACTION_POST_TEXT;
  return ACTION_SCHEDULE_TEXT;
}

export function getPollSubmitActionForMode(
  mode: ComposerPublishMode
): string | null {
  if (mode === "draft") return null;
  if (mode === "now") return ACTION_POST_POLL;
  return ACTION_SCHEDULE_POLL;
}

export function getPrimaryCtaLabelForMode(
  mode: ComposerPublishMode,
  entity: "post" | "poll" | "thread" | "article"
): string {
  if (mode === "draft") return "Save draft";
  if (mode === "queue")
    return entity === "thread" ? "Add thread to queue" : "Add to queue";
  if (mode === "schedule")
    return entity === "thread" ? "Schedule thread" : "Schedule post";
  if (entity === "poll") return "Publish poll now";
  if (entity === "thread") return "Publish thread now";
  if (entity === "article") return "Publish article now";
  return "Publish now";
}
