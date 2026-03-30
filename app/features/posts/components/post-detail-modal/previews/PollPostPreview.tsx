import { useMemo } from "react";

import type { SignedEvent } from "~/features/nostr/types";
import { isPollPostItem, parsePollFromSignedEvent } from "~/features/polls";

import { PollVoteBlock } from "../../PollVoteBlock";
import type { PostDetailModalPost } from "../post-detail-helpers";
import { getPrimaryNoteText } from "../post-detail-helpers";

export function PollPostPreview({
  post,
  type,
  nip88PollsEnabled,
  contextLine,
}: {
  post: PostDetailModalPost;
  type: "draft" | "published" | "scheduled";
  nip88PollsEnabled: boolean;
  contextLine: string;
}) {
  const pollSigned = post.signedEvent as SignedEvent | undefined | null;
  const isPoll =
    nip88PollsEnabled &&
    (type === "published" || type === "scheduled") &&
    isPollPostItem({
      type: "post",
      postType: "postType" in post ? String(post.postType) : undefined,
      signedEvent: pollSigned ?? undefined,
    });

  const pollDef = useMemo(() => {
    if (!isPoll || !pollSigned) return null;
    return parsePollFromSignedEvent(pollSigned);
  }, [isPoll, pollSigned]);

  const primary = getPrimaryNoteText(post);
  const questionTrim = pollDef ? pollDef.question.trim() : "";
  const hideQuestionInPoll =
    Boolean(primary) && primary.trim() === questionTrim;
  const showIntro = Boolean(primary) && primary.trim() !== questionTrim;

  return (
    <div className="space-y-3 py-1">
      {showIntro ? (
        <p className="text-foreground text-[15px] leading-relaxed whitespace-pre-wrap">
          {primary}
        </p>
      ) : null}
      <PollVoteBlock
        post={post}
        type={type}
        nip88PollsEnabled={nip88PollsEnabled}
        layout="inline"
        hideQuestion={hideQuestionInPoll}
      />
      <p className="text-muted-foreground text-xs">{contextLine}</p>
    </div>
  );
}
