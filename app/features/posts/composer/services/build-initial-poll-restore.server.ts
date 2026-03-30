/**
 * Build PollComposer prefill from a persisted POLL draft (loader → client JSON).
 */

import { parsePollFromSignedEvent } from "~/features/polls";

import type { InitialPollRestore } from "../types/initial-poll-restore";

interface DraftPostForPollRestore {
  postType?: string | null;
  content?: string | null;
  caption?: string | null;
  draftMeta?: unknown;
  signedEvent?: {
    kind: number;
    id: string;
    pubkey: string;
    content: string;
    tags: string[][];
    created_at: number;
  } | null;
  tags?: string[] | null;
  hashTagPresetId?: string | null;
  queueType?: { name: string } | null;
}

export function buildInitialPollRestoreFromDraftPost(
  post: DraftPostForPollRestore
): InitialPollRestore | null {
  if (post.postType !== "POLL") return null;

  const signed = post.signedEvent;
  if (signed?.kind === 1068) {
    const def = parsePollFromSignedEvent(signed);
    if (def) {
      const tagsJoined = Array.isArray(post.tags) ? post.tags.join(" ") : "";
      return {
        question: def.question,
        options: def.options.map((o) => o.label),
        pollType: def.pollType,
        endsAtUnix: def.endsAt,
        selectedHashtags: tagsJoined,
        hashTagPresetId: post.hashTagPresetId ?? null,
        queueType: post.queueType?.name ?? "unassigned",
        includeHashtagsInNoteBody: true,
        isRecyclable: false,
      };
    }
  }

  const meta =
    post.draftMeta && typeof post.draftMeta === "object"
      ? (post.draftMeta as Record<string, unknown>)
      : {};
  const question =
    (typeof meta["pollQuestion"] === "string"
      ? meta["pollQuestion"]
      : ""
    ).trim() ||
    (post.content ?? "").trim() ||
    (post.caption ?? "").trim();
  const labelsRaw = meta["pollOptionLabels"];
  const fromMeta = Array.isArray(labelsRaw)
    ? labelsRaw.filter((x): x is string => typeof x === "string")
    : [];
  const options = fromMeta.length >= 2 ? fromMeta : ["", ""];
  const pt = meta["pollType"];
  const pollType = pt === "multiplechoice" ? "multiplechoice" : "singlechoice";
  const endsAtUnix =
    typeof meta["pollEndsAtUnix"] === "number" &&
    Number.isFinite(meta["pollEndsAtUnix"])
      ? Math.floor(meta["pollEndsAtUnix"])
      : undefined;

  return {
    question,
    options,
    pollType,
    endsAtUnix,
    selectedHashtags: Array.isArray(post.tags) ? post.tags.join(" ") : "",
    hashTagPresetId: post.hashTagPresetId ?? null,
    queueType: post.queueType?.name ?? "unassigned",
    includeHashtagsInNoteBody:
      typeof meta["includeHashtagsInNoteBody"] === "boolean"
        ? meta["includeHashtagsInNoteBody"]
        : true,
    isRecyclable: Boolean(meta["isRecyclable"]),
  };
}
