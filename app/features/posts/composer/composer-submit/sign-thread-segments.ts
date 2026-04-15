import type { SignedEvent } from "~/features/nostr/types";
import { nostrAdapter } from "~/lib/nostr-adapter.client";

import {
  appendMediaUrlsForSigning,
  stripAttachmentTokens,
} from "../../utils/inline-tokens";
import { getThreadReplyTags } from "../../utils/repost-quote-events.client";
import type { ThreadSegment } from "../hooks/composer-submit-types";

async function trySignSegmentAt(params: {
  index: number;
  seg: ThreadSegment;
  baseTime: number;
  tagArray: string[][];
  effectiveHashtags: string;
  rootEventId: string | null;
  previousEventId: string | null;
  threadDelayMinutes: number;
  includeHashtagsInNoteBody: boolean;
}): Promise<{ signedEvent: SignedEvent | null }> {
  const {
    index,
    seg,
    baseTime,
    tagArray,
    effectiveHashtags,
    rootEventId,
    previousEventId,
    threadDelayMinutes,
    includeHashtagsInNoteBody,
  } = params;

  const segmentBody = stripAttachmentTokens(seg.content).trim();
  const appendTags = includeHashtagsInNoteBody !== false;
  const bodyWithOptionalTags = appendTags
    ? `${segmentBody}\n${effectiveHashtags}`
    : segmentBody;
  const mediaUrlsForSign = seg.attachments
    .filter((a): a is typeof a & { url: string } => Boolean(a.url))
    .map((a) => a.url);
  const contentWithTags = appendMediaUrlsForSigning(
    bodyWithOptionalTags,
    mediaUrlsForSign
  );
  const created_at = baseTime + index * threadDelayMinutes * 60;
  const tags =
    index === 0
      ? tagArray
      : [...getThreadReplyTags(previousEventId!, rootEventId!), ...tagArray];
  try {
    const { signedEvent } = await nostrAdapter.signEvent(
      {
        content: contentWithTags,
        created_at,
        kind: 1,
        tags,
      },
      { clearCacheOnError: false }
    );
    return { signedEvent };
  } catch {
    return { signedEvent: null };
  }
}

/**
 * Signs each thread segment in order, with one retry pass after a short delay for failures.
 */
export async function signThreadSegmentsWithRetry(params: {
  segments: ThreadSegment[];
  baseTime: number;
  tagArray: string[][];
  effectiveHashtags: string;
  threadDelayMinutes: number;
  includeHashtagsInNoteBody: boolean;
}): Promise<{
  signedByIndex: Array<SignedEvent | null>;
  failedIndices: number[];
}> {
  const {
    segments,
    baseTime,
    tagArray,
    effectiveHashtags,
    threadDelayMinutes,
    includeHashtagsInNoteBody,
  } = params;

  const signedByIndex: Array<SignedEvent | null> = Array.from(
    { length: segments.length },
    (): SignedEvent | null => null
  );
  let rootEventId: string | null = null;
  let previousEventId: string | null = null;
  let failedIndices: number[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (!seg) continue;
    const result = await trySignSegmentAt({
      index: i,
      seg,
      baseTime,
      tagArray,
      effectiveHashtags,
      rootEventId,
      previousEventId,
      threadDelayMinutes,
      includeHashtagsInNoteBody,
    });
    if (result.signedEvent) {
      signedByIndex[i] = result.signedEvent;
      rootEventId = i === 0 ? result.signedEvent.id : rootEventId;
      previousEventId = result.signedEvent.id;
    } else {
      failedIndices.push(i);
    }
  }

  if (failedIndices.length > 0) {
    await new Promise((r) => setTimeout(r, 1500));
    const stillFailed: number[] = [];
    for (const i of failedIndices) {
      const seg = segments[i];
      if (!seg) continue;
      const prevId = i === 0 ? null : (signedByIndex[i - 1]?.id ?? null);
      const rootId = signedByIndex[0]?.id ?? null;
      const result = await trySignSegmentAt({
        index: i,
        seg,
        baseTime,
        tagArray,
        effectiveHashtags,
        rootEventId: rootId,
        previousEventId: prevId,
        threadDelayMinutes,
        includeHashtagsInNoteBody,
      });
      if (result.signedEvent) {
        signedByIndex[i] = result.signedEvent;
      } else {
        stillFailed.push(i);
      }
    }
    failedIndices = stillFailed;
  }

  return { signedByIndex, failedIndices };
}
