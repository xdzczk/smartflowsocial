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
  return {
    type: "poll",
    question: input.question.trim(),
    options,
    mode: input.pollType === "multiplechoice" ? "multiple" : "single",
    endLabel: getPollPreviewEndLabel(input.end),
    tags: parsePreviewTagLabels(input.tagsLine),
    hideTags: input.includeHashtagsInNoteBody === false,
  };
}
