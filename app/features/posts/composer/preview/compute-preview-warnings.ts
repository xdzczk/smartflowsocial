import type { ComposerAttachment } from "~/features/posts/types";

import type {
  NormalizedPollPreview,
  NormalizedThreadPreview,
  PreviewWarning,
} from "./normalized-composer-preview.types";
import { parsePreviewTagLabels } from "./parse-preview-tags";

const SHORT_SEGMENT_CHARS = 12;
const LONG_SEGMENT_CHARS = 900;

export function computePostPreviewWarnings(_input: {
  rawContent: string;
  attachments?: ComposerAttachment[];
}): PreviewWarning[] {
  return [];
}

export function computePollPreviewWarnings(
  normalized: NormalizedPollPreview,
  rawOptions: string[]
): PreviewWarning[] {
  const out: PreviewWarning[] = [];
  const nonEmpty = rawOptions.map((o) => o.trim()).filter((o) => o.length > 0);
  if (nonEmpty.length < 2) {
    out.push({
      id: "poll-options-count",
      message: "Add at least two options to publish this poll.",
      tone: "warn",
    });
  }
  const lower = nonEmpty.map((o) => o.toLowerCase());
  const seen = new Set<string>();
  for (const o of lower) {
    if (seen.has(o)) {
      out.push({
        id: "poll-dup-options",
        message: "Duplicate option text detected.",
        tone: "warn",
      });
      break;
    }
    seen.add(o);
  }
  if (!normalized.hasPollEndDate) {
    out.push({
      id: "poll-no-end",
      message: "This poll has no end date.",
      tone: "info",
    });
  }
  for (const opt of nonEmpty) {
    if (opt.length > 120) {
      out.push({
        id: "poll-long-option",
        message:
          "Some option labels are very long and may wrap awkwardly in clients.",
        tone: "info",
      });
      break;
    }
  }
  return out;
}

export function computeThreadPreviewWarnings(input: {
  normalized: NormalizedThreadPreview;
  rawSegments: Array<{ content: string; attachments: ComposerAttachment[] }>;
}): PreviewWarning[] {
  const out: PreviewWarning[] = [];
  const { segments } = input.normalized;
  const rawMediaCount = (s: { attachments: ComposerAttachment[] }) =>
    s.attachments.filter(
      (a) => Boolean(a.url) || a.status === "uploading" || a.status === "failed"
    ).length;
  const maxMedia = Math.max(
    0,
    ...segments.map((s) => s.media.length),
    ...input.rawSegments.map((s) => rawMediaCount(s))
  );
  const minMedia = Math.min(
    ...segments.map((s) => s.media.length),
    ...input.rawSegments.map((s) => rawMediaCount(s))
  );

  let prevNorm = "";
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    const empty = !seg.text.trim() && seg.media.length === 0;
    if (empty) {
      out.push({
        id: `empty-seg-${seg.id}`,
        message: `Thread segment ${seg.index} is empty.`,
        tone: "warn",
      });
    }
    const len = seg.text.trim().length;
    if (!empty && len > 0 && len < SHORT_SEGMENT_CHARS) {
      out.push({
        id: `short-seg-${seg.id}`,
        message: `Segment ${seg.index} may feel too short as a standalone note.`,
        tone: "info",
      });
    }
    if (len > LONG_SEGMENT_CHARS) {
      out.push({
        id: `long-seg-${seg.id}`,
        message: `Segment ${seg.index} is long and may get truncated in some clients.`,
        tone: "info",
      });
    }
    const norm = seg.text.replace(/\s+/g, " ").trim().toLowerCase();
    if (i > 0 && norm.length > 0 && norm === prevNorm) {
      out.push({
        id: `repeat-seg-${seg.id}`,
        message: `Segment ${seg.index} repeats the previous segment.`,
        tone: "info",
      });
    }
    prevNorm = norm;
  }

  if (segments.length >= 2 && maxMedia >= 3 && minMedia === 0) {
    out.push({
      id: "thread-media-imbalance",
      message:
        "Media is concentrated in one segment; balance may read better as a thread.",
      tone: "info",
    });
  }

  return out;
}

/** Hidden-tags + empty check using tags line (post/thread tag field). */
export function computeHiddenTagsWarning(
  hideTags: boolean,
  tagsLine: string
): PreviewWarning | null {
  const tags = parsePreviewTagLabels(tagsLine);
  if (hideTags && tags.length === 0) {
    return {
      id: "hidden-tags-empty",
      message: "Hidden tags enabled but no tags selected.",
      tone: "info",
    };
  }
  return null;
}
