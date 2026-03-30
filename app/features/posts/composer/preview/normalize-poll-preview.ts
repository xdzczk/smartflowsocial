import type { NormalizedPollPreview } from "./normalized-composer-preview.types";
import { parsePreviewTagLabels } from "./parse-preview-tags";
import {
  getPollPreviewEndLabel,
  type PollPreviewEndInput,
} from "./poll-preview-end-label";

export function normalizePollPreviewFromComposer(input: {
  question: string;
  options: string[];
  pollType: "singlechoice" | "multiplechoice";
  tagsLine: string;
  includeHashtagsInNoteBody: boolean;
  end: PollPreviewEndInput;
}): NormalizedPollPreview {
  const options = input.options
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
  const endLabel = getPollPreviewEndLabel(input.end);
  return {
    type: "poll",
    question: input.question.trim(),
    options,
    mode: input.pollType === "multiplechoice" ? "multiple" : "single",
    endLabel,
    hasPollEndDate: endLabel !== "No end date set",
    tags: parsePreviewTagLabels(input.tagsLine),
    hideTags: input.includeHashtagsInNoteBody === false,
  };
}
