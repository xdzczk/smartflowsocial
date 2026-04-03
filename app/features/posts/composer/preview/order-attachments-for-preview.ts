import type { ComposerAttachment } from "~/features/posts/types";

import type {
  NormalizedPreviewMedia,
  PreviewMediaKind,
} from "./normalized-composer-preview.types";

function mediaKind(mime?: string): PreviewMediaKind {
  return mime?.startsWith("video/") ? "video" : "image";
}

/**
 * Order attachments like the composer strip: array order for items with URLs,
 * then pending/failed without URLs.
 */
export function orderAttachmentsForPreview(
  _content: string,
  attachments: ComposerAttachment[]
): NormalizedPreviewMedia[] {
  const withUrl = attachments.filter(
    (a): a is ComposerAttachment & { url: string } => Boolean(a.url)
  );
  const ordered: NormalizedPreviewMedia[] = withUrl.map((a) => ({
    id: a.localId,
    url: a.url,
    alt: a.alt,
    kind: mediaKind(a.mime),
  }));
  const seen = new Set(ordered.map((m) => m.id));
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
