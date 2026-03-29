import type { ComposerAttachment } from "~/features/posts/types";
import { stripAttachmentTokens } from "~/features/posts/utils/inline-tokens.client";

import type { NormalizedPostPreview } from "./normalized-composer-preview.types";
import { orderAttachmentsForPreview } from "./order-attachments-for-preview";
import { parsePreviewTagLabels } from "./parse-preview-tags";

export function normalizePostPreviewFromComposer(input: {
  content: string;
  attachments: ComposerAttachment[];
  tagsLine: string;
  includeHashtagsInNoteBody: boolean;
}): NormalizedPostPreview {
  const tags = parsePreviewTagLabels(input.tagsLine);
  return {
    type: "post",
    text: stripAttachmentTokens(input.content).trimEnd(),
    media: orderAttachmentsForPreview(input.content, input.attachments),
    tags,
    hideTags: input.includeHashtagsInNoteBody === false,
  };
}
