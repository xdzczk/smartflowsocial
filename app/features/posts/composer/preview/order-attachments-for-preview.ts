import type { ComposerAttachment } from "~/features/posts/types";
import { getTokenLocalIds } from "~/features/posts/utils/inline-tokens.client";

import type {
  NormalizedPreviewMedia,
  PreviewMediaKind,
} from "./normalized-composer-preview.types";

function mediaKind(mime?: string): PreviewMediaKind {
  return mime?.startsWith("video/") ? "video" : "image";
}

/**
 * Order attachments like the composer strip: token order in content, then any
 * remaining attachments with URLs (no token) in array order.
 */
export function orderAttachmentsForPreview(
  content: string,
  attachments: ComposerAttachment[]
): NormalizedPreviewMedia[] {
  const withUrl = attachments.filter(
    (a): a is ComposerAttachment & { url: string } => Boolean(a.url)
  );
  const byId = new Map(withUrl.map((a) => [a.localId, a]));
  const ordered: NormalizedPreviewMedia[] = [];
  const seen = new Set<string>();
  for (const id of getTokenLocalIds(content)) {
    const a = byId.get(id);
    if (!a) continue;
    ordered.push({
      id: a.localId,
      url: a.url,
      alt: a.alt,
      kind: mediaKind(a.mime),
    });
    seen.add(id);
  }
  for (const a of withUrl) {
    if (seen.has(a.localId)) continue;
    ordered.push({
      id: a.localId,
      url: a.url,
      alt: a.alt,
      kind: mediaKind(a.mime),
    });
  }
  const pending = attachments.filter(
    (a) => (a.status === "uploading" || a.status === "failed") && !a.url
  );
  for (const a of pending) {
    if (seen.has(a.localId)) continue;
    ordered.push({
      id: a.localId,
      url: "",
      alt: a.alt,
      kind: mediaKind(a.mime),
      phase: a.status === "uploading" ? "uploading" : "failed",
      failureMessage: a.uploadErrorMessage,
      fileLabel: a.file?.name,
    });
    seen.add(a.localId);
  }
  return ordered;
}
