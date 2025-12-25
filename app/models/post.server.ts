import type { Post, PostType, QueueType, Prisma } from "@prisma/client";

import { prisma } from "~/lib/prisma.server";
import type { SignedEvent, NostrEvent } from "~/features/nostr/types";

interface CreatePostData {
  userId: string;
  content?: string;
  postedAt?: Date;
  fileUrl: string[];
  scheduledFor?: Date | string;
  nostrEventId?: string;
  signedEvent?: SignedEvent;
  nostrEvent?: NostrEvent;
  postType: PostType;
  tags: string[];
  caption?: string;
  isScheduled: boolean;
  isPosted: boolean;
  manual_override?: boolean;
  queueType?: string;
  queueTypeId?: string; // Direct queue type ID
  draft?: boolean;
  repost?: boolean;
  isQuotedPost?: boolean;
  isRecyclable?: boolean;
  hashTagPresetId?: string | null;
}

export type PostWithQueueType = Post & { queueType: QueueType | null };

interface PostsWithPagination {
  posts: PostWithQueueType[];
  pagination: {
    total: number;
    pages: number;
    currentPage: number;
    limit: number;
  };
}

interface PostStatistics {
  scheduledCount: number;
  successCount: number;
}

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
    queueType,
    queueTypeId,
    draft,
    repost,
    isQuotedPost,
    isRecyclable,
    hashTagPresetId,
  } = data;
  // Get queueTypeId - use direct ID if provided, otherwise lookup by name
  let finalQueueTypeId = null;
  if (queueTypeId) {
    // Use provided queue type ID directly
    finalQueueTypeId = queueTypeId;
  } else if (queueType && queueType !== "unassigned") {
    // Fallback to name lookup for backward compatibility
    const queueTypeRecord = await prisma.queueType.findFirst({
      where: {
        userId,
        name: queueType,
      },
      select: {
        id: true,
      },
    });
    finalQueueTypeId = queueTypeRecord?.id || null;
  }

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
      ...(finalQueueTypeId && {
        queueType: {
          connect: {
            id: finalQueueTypeId,
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

export async function getScheduledPosts({
  userId,
  queueType,
}: {
  userId: string;
  queueType?: string;
}): Promise<PostWithQueueType[]> {
  const whereClause: Prisma.PostWhereInput = {
    isScheduled: true,
    isPosted: false,
    draft: false,
    userId: userId,
  };

  // Add queue type filter if specified
  if (queueType && queueType !== "all") {
    whereClause.queueType = {
      name: queueType,
    };
  }

  return prisma.post.findMany({
    where: whereClause,
    include: {
      queueType: true,
    },
    orderBy: {
      scheduledFor: "asc",
    },
  });
}

export async function getDraftPosts({
  userId,
  queueType,
}: {
  userId: string;
  queueType?: string;
}): Promise<PostWithQueueType[]> {
  const whereClause: Prisma.PostWhereInput = {
    draft: true,
    isPosted: false,
    userId: userId,
  };

  // Add queue type filter if specified
  if (queueType && queueType !== "all") {
    whereClause.queueType = {
      name: queueType,
    };
  }

  return prisma.post.findMany({
    where: whereClause,
    include: {
      queueType: true,
    },
    orderBy: {
      createdAt: "desc",
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

export async function getCronDueScheduledPosts(): Promise<Post[]> {
  const now = Math.floor(Date.now() / 1000).toString();
  return prisma.post.findMany({
    where: {
      isScheduled: true,
      isPosted: false,
      scheduledFor: {
        lte: now,
      },
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

export async function getPostedPosts({
  userId,
  page = 1,
  limit = 50,
  queueType,
}: {
  userId: string;
  page?: number;
  limit?: number;
  queueType?: string;
}): Promise<PostsWithPagination> {
  const skip = (page - 1) * limit;

  const whereClause: Prisma.PostWhereInput = {
    isPosted: true,
    userId: userId,
  };

  // Add queue type filter if specified
  if (queueType && queueType !== "all") {
    whereClause.queueType = {
      name: queueType,
    };
  }

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where: whereClause,
      include: {
        queueType: true,
      },
      orderBy: {
        postedAt: "desc",
      },
      skip,
      take: limit,
    }),
    prisma.post.count({
      where: whereClause,
    }),
  ]);

  return {
    posts,
    pagination: {
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
      limit,
    },
  };
}

export async function getRecentPostedPosts({
  userId,
  days,
  queueType,
}: {
  userId: string;
  days: number;
  queueType?: string;
}): Promise<PostWithQueueType[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const whereClause: Prisma.PostWhereInput = {
    isPosted: true,
    userId: userId,
    postedAt: {
      gte: startDate,
    },
  };

  // Add queue type filter if specified
  if (queueType && queueType !== "all") {
    whereClause.queueType = {
      name: queueType,
    };
  }

  const posts = await prisma.post.findMany({
    where: whereClause,
    include: {
      queueType: true,
    },
    orderBy: {
      postedAt: "desc",
    },
  });

  return posts;
}

export async function getPostStatistics({
  userId,
}: {
  userId: string;
}): Promise<PostStatistics> {
  const [scheduledCount, successCount] = await Promise.all([
    // Get count of scheduled posts
    prisma.post.count({
      where: {
        userId,
        isPosted: false,
        isScheduled: true,
      },
    }),

    // Get count of successfully posted
    prisma.post.count({
      where: {
        userId,
        isPosted: true,
      },
    }),
  ]);

  return {
    scheduledCount,
    successCount,
  };
}

export async function getPastPosts({
  userId,
  startDate,
  endDate,
  queueType,
}: {
  userId: string;
  startDate: Date;
  endDate: Date;
  queueType?: string;
}): Promise<PostWithQueueType[]> {
  const whereClause: Prisma.PostWhereInput = {
    userId,
    // Look for posts that are either marked as posted OR have a posted status
    OR: [{ isPosted: true }, { status: "POSTED" }],
    postedAt: {
      gte: startDate,
      lte: endDate,
      not: null, // Ensure postedAt is not null
    },
  };

  // Add queue type filter if specified
  if (queueType && queueType !== "all") {
    whereClause.queueType = {
      name: queueType,
    };
  }

  return prisma.post.findMany({
    where: whereClause,
    include: {
      queueType: true,
    },
    orderBy: {
      postedAt: "desc",
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

export async function getPostById({
  id,
  userId,
}: {
  id: string;
  userId: string;
}): Promise<Post | null> {
  return prisma.post.findFirst({
    where: {
      id,
      userId,
    },
  });
}

export async function getPostsByIds({
  ids,
  userId,
}: {
  ids: string[];
  userId: string;
}): Promise<PostWithQueueType[]> {
  return prisma.post.findMany({
    where: {
      id: {
        in: ids,
      },
      userId,
    },
    include: {
      queueType: true,
    },
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

  // Handle queueType conversion to queueTypeId
  if (data.queueType !== undefined) {
    delete updateData.queueType; // Remove queueType from updateData

    if (data.queueType && data.queueType !== "unassigned") {
      // Find the queueType record to get its ID
      const queueTypeRecord = await prisma.queueType.findFirst({
        where: {
          userId,
          name: data.queueType,
        },
        select: {
          id: true,
        },
      });

      if (queueTypeRecord) {
        updateData.queueType = {
          connect: {
            id: queueTypeRecord.id,
          },
        };
      }
    } else {
      // Disconnect from queue type if "unassigned"
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

export async function getRecyclablePosts({
  userId,
  page = 1,
  limit = 50,
  queueType,
}: {
  userId: string;
  page?: number;
  limit?: number;
  queueType?: string;
}): Promise<PostsWithPagination> {
  const skip = (page - 1) * limit;

  const whereClause: Prisma.PostWhereInput = {
    isRecyclable: true,
    isPosted: true,
    userId: userId,
  };

  // Add queue type filter if specified
  if (queueType && queueType !== "all") {
    whereClause.queueType = {
      name: queueType,
    };
  }

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where: whereClause,
      include: {
        queueType: true,
      },
      orderBy: {
        postedAt: "desc",
      },
      skip,
      take: limit,
    }),
    prisma.post.count({
      where: whereClause,
    }),
  ]);

  return {
    posts,
    pagination: {
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
      limit,
    },
  };
}

export async function getLastPostTimeForQueue({
  userId,
  queueTypeName,
  queueTypeId,
}: {
  userId: string;
  queueTypeName?: string;
  queueTypeId?: string;
}): Promise<Date | null> {
  let queueType;

  if (queueTypeId) {
    // Direct lookup by ID (preferred method)
    queueType = await prisma.queueType.findFirst({
      where: {
        id: queueTypeId,
        userId, // Ensure the queue belongs to the user
      },
      select: {
        id: true,
        scheduleType: true,
        name: true,
      },
    });
  } else if (queueTypeName) {
    // Fallback to name-based lookup
    queueType = await prisma.queueType.findFirst({
      where: {
        userId,
        name: queueTypeName,
      },
      select: {
        id: true,
        scheduleType: true,
        name: true,
      },
    });
  }

  if (!queueType) {
    return null; // Queue type doesn't exist
  }

  // For FIXED_SLOTS scheduling, we need to consider ALL scheduled posts (both posted and unposted)
  // to find the actual last scheduled time, regardless of posting status
  // For INTERVAL scheduling, we can stick with the original logic of only considering unposted posts
  const whereCondition = {
    userId,
    queueTypeId: queueType.id,
    isScheduled: true,
    NOT: {
      draft: true, // Exclude drafts
    },
    scheduledFor: {
      not: null, // Ensure scheduledFor is not null
    },
    // For FIXED_SLOTS: include both posted and unposted posts
    // For INTERVAL: only include unposted posts (original behavior)
    ...(queueType.scheduleType === "INTERVAL" && {
      isPosted: false, // Only for interval-based scheduling
    }),
  };

  // Get the most recent scheduled post for this queue
  const lastPost = await prisma.post.findFirst({
    where: whereCondition,
    orderBy: {
      scheduledFor: "desc", // Order by scheduled time to get the latest scheduled post
    },
    select: {
      scheduledFor: true,
      createdAt: true,
      isPosted: true,
    },
  });

  if (!lastPost?.scheduledFor) {
    return null;
  }

  // Convert scheduledFor string to Date
  // scheduledFor appears to be a Unix timestamp string
  try {
    const timestamp = parseInt(lastPost.scheduledFor);
    if (isNaN(timestamp)) {
      // If it's not a timestamp, try parsing as ISO string
      return new Date(lastPost.scheduledFor);
    }
    // Convert Unix timestamp (seconds) to Date
    const parsedDate = new Date(timestamp * 1000);

    return parsedDate;
  } catch (error) {
    console.error("Error parsing scheduledFor:", lastPost.scheduledFor, error);
    return null;
  }
}
