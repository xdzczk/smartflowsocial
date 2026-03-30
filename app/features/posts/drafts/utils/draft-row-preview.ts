/**
 * Type-specific title, subtitle, and chips for Drafts table / cards.
 */

import {
  isPollDraftPost,
  isRepostDraftPost,
  isThreadDraftPost,
  type DraftPostLike,
} from "./draft-post-classification";

export interface DraftRowPreview {
  title: string;
  subtitle: string;
  chips: string[];
}

function firstMeaningfulLine(
  text: string | null | undefined,
  maxLen = 120
): string {
  if (!text?.trim()) return "";
  const line = text.trim().split(/\r?\n/u)[0] ?? "";
  if (line.length <= maxLen) return line;
  return `${line.slice(0, maxLen - 1)}…`;
}

function countMediaUrls(fileUrl: string[] | null | undefined): number {
  if (!fileUrl?.length) return 0;
  if (typeof fileUrl[0] === "string" && fileUrl[0].startsWith("[")) {
    try {
      const parsed = JSON.parse(fileUrl[0]) as unknown;
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return fileUrl.length;
    }
  }
  return fileUrl.length;
}

function draftMetaThreadTitle(
  meta: Record<string, unknown> | null
): string | null {
  if (!meta) return null;
  const t = meta["threadTitle"];
  return typeof t === "string" && t.trim() ? t.trim() : null;
}

function threadSegmentCount(meta: unknown): number {
  if (!meta || typeof meta !== "object") return 0;
  const ts = (meta as { threadSegments?: unknown }).threadSegments;
  return Array.isArray(ts) ? ts.length : 0;
}

function threadFirstSnippet(meta: unknown): string {
  if (!meta || typeof meta !== "object") return "";
  const ts = (meta as { threadSegments?: unknown }).threadSegments;
  if (!Array.isArray(ts) || ts.length === 0) return "";
  const firstEl: unknown = ts[0];
  if (firstEl && typeof firstEl === "object" && "content" in firstEl) {
    const c = (firstEl as { content?: unknown }).content;
    return typeof c === "string" ? firstMeaningfulLine(c, 80) : "";
  }
  return "";
}

function pollMetaFromDraft(post: DraftPostLike & { content?: string | null }): {
  question: string;
  optionCount: number;
} {
  const meta =
    post.draftMeta && typeof post.draftMeta === "object"
      ? (post.draftMeta as Record<string, unknown>)
      : null;
  const labels = meta?.["pollOptionLabels"];
  let optionCount = 0;
  if (Array.isArray(labels)) {
    optionCount = labels.filter(
      (x) => typeof x === "string" && x.trim()
    ).length;
  }
  const pollQuestion = meta?.["pollQuestion"];
  const q =
    (typeof pollQuestion === "string" && pollQuestion.trim() !== ""
      ? pollQuestion
      : undefined) ??
    post.content ??
    "";
  return {
    question: firstMeaningfulLine(typeof q === "string" ? q : "", 100),
    optionCount,
  };
}

/* eslint-disable-next-line sonarjs/cognitive-complexity -- Branches mirror draft post kinds (poll / thread / repost / plain) */
export function buildDraftRowPreview(
  post: DraftPostLike & {
    id: string;
    caption?: string | null;
    content?: string | null;
    fileUrl?: string[] | null;
  }
): DraftRowPreview {
  const chips: string[] = [];
  const mediaCount = countMediaUrls(post.fileUrl ?? null);

  if (isPollDraftPost(post)) {
    const { question, optionCount } = pollMetaFromDraft(post);
    const title = question.trim() !== "" ? question : "Poll";
    const subtitle =
      optionCount > 0
        ? `${optionCount} option${optionCount === 1 ? "" : "s"}`
        : "Poll draft";
    chips.push("Poll");
    return { title, subtitle, chips };
  }

  if (isThreadDraftPost(post)) {
    const meta =
      post.draftMeta && typeof post.draftMeta === "object"
        ? (post.draftMeta as Record<string, unknown>)
        : null;
    const n = threadSegmentCount(post.draftMeta);
    const title = draftMetaThreadTitle(meta) ?? "Untitled thread";
    const start = threadFirstSnippet(post.draftMeta);
    const subtitle =
      n > 0
        ? start
          ? `${n} posts · starts with: ${start}`
          : `${n} post${n === 1 ? "" : "s"}`
        : "Thread draft";
    chips.push("Thread");
    return { title, subtitle, chips };
  }

  if (isRepostDraftPost(post)) {
    chips.push("Repost");
  }

  const cap = post.caption?.trim();
  const body = post.content?.trim();
  const title =
    (cap && cap.length > 0 ? cap : undefined) ??
    (body && body.length > 0 ? firstMeaningfulLine(body, 100) : undefined) ??
    "Untitled post";
  const subtitle =
    cap && body && cap !== body ? firstMeaningfulLine(body, 100) : "";
  if (mediaCount > 0) {
    chips.push(`${mediaCount} image${mediaCount === 1 ? "" : "s"}`);
  }
  if (!isRepostDraftPost(post) && !cap && !body) {
    chips.push("TEXT");
  }
  return {
    title,
    subtitle:
      subtitle.length > 0 ? subtitle : mediaCount === 0 && !cap ? "" : subtitle,
    chips,
  };
}

export function draftTypeLabel(
  post: DraftPostLike & { caption?: string | null; content?: string | null }
): "Post" | "Poll" | "Thread" | "Repost" {
  if (isPollDraftPost(post)) return "Poll";
  if (isThreadDraftPost(post)) return "Thread";
  if (isRepostDraftPost(post)) return "Repost";
  return "Post";
}
