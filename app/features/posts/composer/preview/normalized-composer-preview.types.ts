export type PreviewWarningTone = "info" | "warn";

export interface PreviewWarning {
  id: string;
  message: string;
  tone?: PreviewWarningTone;
}

export type PreviewMediaKind = "image" | "video";

export interface NormalizedPreviewMedia {
  id: string;
  url: string;
  alt?: string;
  kind: PreviewMediaKind;
  /** In-composer upload not finished or failed (no public URL yet). */
  phase?: "uploading" | "failed";
  failureMessage?: string;
  fileLabel?: string;
}

export interface NormalizedPostPreview {
  type: "post";
  text: string;
  media: NormalizedPreviewMedia[];
  tags: string[];
  hideTags: boolean;
}

export interface NormalizedPollPreview {
  type: "poll";
  question: string;
  options: string[];
  mode: "single" | "multiple";
  endLabel: string;
  /** False when absolute end is unset (`No end date set`); warning strip carries the message. */
  hasPollEndDate: boolean;
  tags: string[];
  hideTags: boolean;
}

export interface NormalizedThreadSegmentPreview {
  id: string;
  index: number;
  text: string;
  media: NormalizedPreviewMedia[];
}

export interface NormalizedThreadPreview {
  type: "thread";
  segments: NormalizedThreadSegmentPreview[];
  cadenceMinutes: number;
}

export interface NormalizedArticlePreview {
  type: "article";
  title: string;
  summary?: string;
  body?: string;
  coverImage?: string | null;
}

export type NormalizedComposerPreview =
  | NormalizedPostPreview
  | NormalizedPollPreview
  | NormalizedThreadPreview
  | NormalizedArticlePreview;
