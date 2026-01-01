/**
 * Post Model - Command Operations (Writes)
 * 
 * This module provides write operations for Post entities.
 * All functions in this file perform INSERT, UPDATE, or DELETE operations.
 */

import { Prisma, type Post } from "@prisma/client";

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
export function createPost(data: CreatePostData): Promise<Post> {
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
      manual_override: manual_override ?? false,
      draft: draft ?? false,
      repost: repost ?? false,
      isQuotedPost: isQuotedPost ?? false,
      isRecyclable: isRecyclable ?? false,
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

export function deletePost({
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

export function updatePostStatus({
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

export function reschedulePost({
  id,
  userId,
  newScheduledFor,
  overrideQueue,
  signedEvent,
  nostrEvent,
  queueTypeId,
}: {
  id: string;
  userId: string;
  newScheduledFor: string;
  overrideQueue: boolean;
  signedEvent?: SignedEvent;
  nostrEvent?: NostrEvent;
  queueTypeId?: string | null;
}): Promise<Post> {
  const updateData: Prisma.PostUpdateInput = {
    scheduledFor: newScheduledFor,
    manual_override: overrideQueue,
    updatedAt: new Date(),
  };

  // If new signed events are provided, update them, otherwise clear them
  if (signedEvent && nostrEvent) {
    // Prisma expects InputJsonValue for these fields
    updateData.signedEvent = signedEvent as unknown as Prisma.InputJsonValue;
    updateData.nostrEvent = nostrEvent as unknown as Prisma.InputJsonValue;
    updateData.nostrEventId = signedEvent.id;
  } else {
    // Clear signed event since timing changed - needs re-signing
    updateData.signedEvent = Prisma.DbNull;
    updateData.nostrEvent = Prisma.DbNull;
    updateData.nostrEventId = null;
  }

  // Handle queueTypeId connection/disconnection
  if (queueTypeId !== undefined) {
    if (queueTypeId) {
      updateData.queueType = {
        connect: {
          id: queueTypeId,
        },
      };
    } else {
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

export function updatePost({
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
    updatedAt: new Date(),
  };

  // Only include defined fields
  if (data.scheduledFor !== undefined) updateData.scheduledFor = data.scheduledFor.toString();
  if (data.userId !== undefined) updateData.user = { connect: { id: data.userId } };
  if (data.content !== undefined) updateData.content = data.content;
  if (data.caption !== undefined) updateData.caption = data.caption;
  if (data.postedAt !== undefined) updateData.postedAt = data.postedAt;
  if (data.fileUrl !== undefined) updateData.fileUrl = data.fileUrl;
  if (data.nostrEventId !== undefined) updateData.nostrEventId = data.nostrEventId;
  if (data.signedEvent !== undefined) updateData.signedEvent = data.signedEvent as unknown as Prisma.InputJsonValue;
  if (data.nostrEvent !== undefined) updateData.nostrEvent = data.nostrEvent as unknown as Prisma.InputJsonValue;
  if (data.tags !== undefined) updateData.tags = data.tags;
  // Note: status, isPublished, isScheduled, draft are Prisma Post model fields, not in CreatePostData
  // They should be set via separate update calls if needed
  if (data.draft !== undefined) updateData.draft = data.draft;
  if (data.isScheduled !== undefined) updateData.isScheduled = data.isScheduled;
  // templateId is not in CreatePostData, handle separately if needed
  if ("templateId" in data && data.templateId !== undefined) {
    if (data.templateId === null) {
      updateData.template = { disconnect: true };
    } else {
      updateData.template = { connect: { id: String(data.templateId) } };
    }
  }
  if (data.hashTagPresetId !== undefined) {
    if (data.hashTagPresetId === null) {
      updateData.hashTagPreset = { disconnect: true };
    } else {
      updateData.hashTagPreset = { connect: { id: data.hashTagPresetId } };
    }
  }

  // Handle queueTypeId connection/disconnection
  if (data.queueTypeId !== undefined) {
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

