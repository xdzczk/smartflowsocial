/**
 * Draft edit loader data preparation
 * Centralized data fetching for draft edit page
 */

import { toPostDTO, type PostDTO } from "~/features/posts/dtos";
import { deriveIsDraft } from "~/features/posts/state-machine/post-state";
import type { PostData } from "~/features/posts/types";
import { convertPrismaQueueTypeToQueueType } from "~/features/posts/types";
import {
  getUserById,
  getQueueTypes,
  getUserHashTagPresets,
} from "~/features/user";
import { getPostById } from "~/models/post.queries.server";

import { getDraftVersions } from "./draft-version.server";

/**
 * Load draft edit data
 */
export async function loadDraftEditData(userId: string, postId: string) {
  const [post, user, queueTypes, hashTagPresets] = await Promise.all([
    getPostById({ id: postId, userId }),
    getUserById(userId),
    getQueueTypes(userId),
    getUserHashTagPresets(userId),
  ]);

  // Use currentState as single source of truth (flags removed from Post model)
  if (!post) {
    throw new Response("Draft not found", { status: 404 });
  }
  const isDraft = deriveIsDraft(post.currentState);
  if (!isDraft) {
    throw new Response("Draft not found", { status: 404 });
  }

  // Convert Post to PostData and serialize to DTO
  // getPostById returns Post with includes, so queueType might be in the post
  const queueType = "queueType" in post ? post.queueType : null;
  const { queueType: _queueType, ...rest } = post as {
    queueType?: unknown;
    [key: string]: unknown;
  };
  const signedEventValue: PostData["signedEvent"] =
    post.signedEvent as PostData["signedEvent"];
  const nostrEventValue: PostData["nostrEvent"] =
    post.nostrEvent as PostData["nostrEvent"];
  const postData: PostData = {
    ...rest,
    queueType: convertPrismaQueueTypeToQueueType(
      queueType as Parameters<typeof convertPrismaQueueTypeToQueueType>[0]
    ),
    signedEvent: signedEventValue,
    nostrEvent: nostrEventValue,
  } as unknown as PostData;

  const postDTO: PostDTO = toPostDTO(postData);

  const versions = await getDraftVersions(postId, null);

  return {
    post: postDTO,
    user,
    queueTypes: queueTypes.filter((qt) => qt.isEnabled !== false),
    hashTagPresets,
    versions,
  };
}
