/**
 * NIP-88 poll voting + tallies inside post details (published/scheduled with signed 1068).
 */

import type { Post } from "../data/posts-prisma-types.server";
import type { CombinedContent, PostData } from "../types";

import { PollVoteBlock } from "./PollVoteBlock";

export interface PostDetailsPollPanelProps {
  post: Post | PostData | CombinedContent;
  type: "draft" | "published" | "scheduled";
  nip88PollsEnabled: boolean;
}

export function PostDetailsPollPanel({
  post,
  type,
  nip88PollsEnabled,
}: PostDetailsPollPanelProps) {
  return (
    <PollVoteBlock
      post={post}
      type={type}
      nip88PollsEnabled={nip88PollsEnabled}
      layout="card"
    />
  );
}
