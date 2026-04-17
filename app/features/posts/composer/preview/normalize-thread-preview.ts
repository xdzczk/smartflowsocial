import type { ComposerAttachment } from "~/features/posts/types";
import { stripAttachmentTokens } from "~/features/posts/utils/inline-tokens";

import type { NormalizedThreadPreview } from "./normalized-composer-preview.types";
import { orderAttachmentsForPreview } from "./order-attachments-for-preview";
import { parsePreviewTagLabels } from "./parse-preview-tags";

export interface ThreadSegmentInput {
  id: string;
  content: string;
  attachments: ComposerAttachment[];
}

/** Tags line + hide flag are used by callers for shared tag row; not stored on normalized thread. */
export function normalizeThreadPreviewFromComposer(input: {
  segments: ThreadSegmentInput[];
  cadenceMinutes: number;
}): NormalizedThreadPreview {
  return {
    type: "thread",
    cadenceMinutes: input.cadenceMinutes,
    segments: input.segments.map((seg, i) => ({
      id: seg.id,
      index: i + 1,
      text: stripAttachmentTokens(seg.content).trimEnd(),
      media: orderAttachmentsForPreview(seg.content, seg.attachments),
    })),
  };
}

export { parsePreviewTagLabels };
