/**
 * Post Model - Command Operations (Writes)
 * 
 * This module provides write operations for Post entities.
 * All functions in this file perform INSERT, UPDATE, or DELETE operations.
 */

import type { Prisma , Post } from "@prisma/client";

import type { SignedEvent, NostrEvent } from "~/features/nostr/types";
import { prisma } from "~/lib/prisma.server";

import type { CreatePostData } from "./post.types";

/**
 * Create a new post in the database
 * 
 * Note: This is a pure data access function. For best practices,
 * resolve queueTypeId in the feature layer before calling this function.
 * Use resolveQueueTypeId() from app/features/posts/services/queue-type-resolver.server.ts
 */
export async function createPost(data: CreatePostData): Promise<Post> {
  const {
    userId,
    content,
    postedAt,
    fileUrl,
    scheduledFor,
    nostrEventId,
    signedEvent,
    nostrEvent,
    postType,
    tags,
    caption,
    isScheduled,
    isPosted,
    manual_override,
    queueTypeId,
    draft,
    repost,
    isQuotedPost,
    isRecyclable,
    hashTagPresetId,
  } = data;

  return prisma.post.create({
    data: {
      content,
      fileUrl,
      scheduledFor: scheduledFor?.toString(),
      nostrEventId,
      signedEvent,
      nostrEvent,
      postType,
      postedAt,
      caption,
      isScheduled,
      isPosted,
      tags,
      manual_override: manual_override || false,
      draft: draft || false,
      repost: repost || false,
      isQuotedPost: isQuotedPost || false,
      isRecyclable: isRecyclable || false,
      user: {
        connect: {
          id: userId,
        },
      },
      ...(queueTypeId && {
        queueType: {
          connect: {
            id: queueTypeId,
          },
        },
      }),
      ...(hashTagPresetId && {
        hashTagPreset: {
          connect: {
            id: hashTagPresetId,
          },
        },
      }),
    },
  });
}

export async function deletePost({
  id,
  userId,
}: {
  id: string;
  userId: string;
}): Promise<Post> {
  return prisma.post.delete({
    where: {
      id,
      userId,
    },
  });
}

export async function updatePostStatus({
  id,
  userId,
  isPosted,
}: {
  id: string;
  userId: string;
  isPosted: boolean;
}): Promise<Post> {
  return prisma.post.update({
    where: {
      id,
      userId,
    },
    data: {
      isPosted,
      postedAt: new Date(),
    },
  });
}

export async function reschedulePost({
  id,
  userId,
  newScheduledFor,
  overrideQueue,
  signedEvent,
  nostrEvent,
}: {
  id: string;
  userId: string;
  newScheduledFor: string;
  overrideQueue: boolean;
  signedEvent?: SignedEvent;
  nostrEvent?: NostrEvent;
}): Promise<Post> {
  const updateData: Partial<Post> = {
    scheduledFor: newScheduledFor,
    manual_override: overrideQueue,
    updatedAt: new Date(),
  };

  // If new signed events are provided, update them, otherwise clear them
  if (signedEvent && nostrEvent) {
    updateData.signedEvent = signedEvent;
    updateData.nostrEvent = nostrEvent;
    updateData.nostrEventId = signedEvent.id;
  } else {
    // Clear signed event since timing changed - needs re-signing
    updateData.signedEvent = null;
    updateData.nostrEvent = null;
    updateData.nostrEventId = null;
  }

  return prisma.post.update({
    where: {
      id,
      userId,
    },
    data: updateData,
  });
}

export async function updatePost({
  id,
  userId,
  data,
}: {
  id: string;
  userId: string;
  data: Partial<CreatePostData>;
}): Promise<Post> {
  // Prepare the update data
  const updateData: Prisma.PostUpdateInput = {
    ...data,
    scheduledFor: data.scheduledFor?.toString(),
    updatedAt: new Date(),
  };

  // Handle queueTypeId connection/disconnection
  if (data.queueTypeId !== undefined) {
    delete updateData.queueTypeId; // Remove queueTypeId from updateData (Prisma expects connect/disconnect)

    if (data.queueTypeId) {
      updateData.queueType = {
        connect: {
          id: data.queueTypeId,
        },
      };
    } else {
      // Disconnect from queue type if null
      updateData.queueType = {
        disconnect: true,
      };
    }
  }

  return prisma.post.update({
    where: {
      id,
      userId,
    },
    data: updateData,
  });
}

