/**
 * Queue workers and initialization
 * 
 * This file handles the worker processes that process queue jobs.
 * For enqueueing/canceling jobs, use the queue abstraction layer:
 *   import { enqueuePostJob, cancelPostJob } from "~/infra/queue";
 */

import { Worker, Job } from "bullmq";

import {
  updateLongFormPostStatus,
  getCronDueScheduledLongFormPosts,
} from "~/models/longformpost.server";
import {
  updatePostStatus,
  getCronDueScheduledPosts,
} from "~/models/post.server";
import { getUserById } from "~/models/user.server";
import { prisma } from "~/lib/prisma.server";
import {
  getQueueInstance,
  redis,
  closeAllQueues,
} from "~/infra/queue";
import type {
  PostJobData,
  LongFormPostJobData,
} from "~/infra/queue";

// Get queue instances using the abstraction
const scheduledPostsQueue = getQueueInstance("scheduled-posts");
const scheduledLongFormPostsQueue = getQueueInstance("scheduled-longform-posts");
const postCheckerQueue = getQueueInstance("post-checker");

// Worker to process scheduled posts
export const scheduledPostsWorker = new Worker<PostJobData>(
  "scheduled-posts",
  async (job: Job<PostJobData>) => {
    const { postId, userId, signedEvent } = job.data;

    try {
      // Idempotency check: verify post exists and is not already posted
      const existingPost = await prisma.post.findUnique({
        where: { id: postId, userId },
        select: { isPosted: true, nostrEventId: true },
      });

      if (!existingPost) {
        throw new Error(`Post ${postId} not found for user ${userId}`);
      }

      // If already posted, skip processing (idempotency)
      if (existingPost.isPosted) {
        console.log(`Post ${postId} already posted, skipping duplicate job`);
        return { success: true, postId, skipped: true };
      }

      // Update post status to posted (atomic operation)
      await updatePostStatus({
        id: postId,
        userId: userId,
        isPosted: true,
      });

      // Get user relays
      const user = await getUserById(userId);
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }
      const sanitizedRelays = (user.userRelays || []).map((relay: string) => relay.trim());

      // Post to nostr publisher endpoint
      const response = await fetch(process.env.NOSTR_PUBLISHER_URL!, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          relays: sanitizedRelays,
          event: signedEvent,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to post to nostr publisher: ${response.statusText}`,
        );
      }

      return { success: true, postId };
    } catch (error) {
      console.error(`Error processing scheduled post ${postId}:`, error);
      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 5,
  },
);

// Worker to process scheduled longform posts
export const scheduledLongFormPostsWorker = new Worker<LongFormPostJobData>(
  "scheduled-longform-posts",
  async (job: Job<LongFormPostJobData>) => {
    const { postId, userId, signedEvent } = job.data;

    try {
      // Idempotency check: verify post exists and is not already published
      const existingPost = await prisma.longFormPost.findUnique({
        where: { id: postId, userId },
        select: { isPublished: true, nostrEventId: true },
      });

      if (!existingPost) {
        throw new Error(`Longform post ${postId} not found for user ${userId}`);
      }

      // If already published, skip processing (idempotency)
      if (existingPost.isPublished) {
        console.log(`Longform post ${postId} already published, skipping duplicate job`);
        return { success: true, postId, skipped: true };
      }

      // Update longform post status to published (atomic operation)
      await updateLongFormPostStatus({
        id: postId,
        userId: userId,
        isPublished: true,
      });

      // Get user relays
      const user = await getUserById(userId);
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }
      const sanitizedRelays = (user.userRelays || []).map((relay: string) => relay.trim());

      // Post to nostr publisher endpoint
      const response = await fetch(process.env.NOSTR_PUBLISHER_URL!, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          relays: sanitizedRelays,
          event: signedEvent,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to post longform to nostr publisher: ${response.statusText}`,
        );
      }

      return { success: true, postId };
    } catch (error) {
      console.error(
        `Error processing scheduled longform post ${postId}:`,
        error,
      );
      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 5,
  },
);

// Worker to check for due posts and schedule them
export const postCheckerWorker = new Worker(
  "post-checker",
  async () => {
    try {
      const [posts, longformPosts] = await Promise.all([
        getCronDueScheduledPosts(),
        getCronDueScheduledLongFormPosts(),
      ]);
      const now = Math.floor(Date.now() / 1000);

      // Process regular posts
      for (const post of posts) {
        if (!post.userId || !post.signedEvent || !post.scheduledFor) continue;
        
        const scheduledTime = parseInt(post.scheduledFor, 10);
        const timeDiff = scheduledTime - now;

        if (timeDiff <= 1) {
          // Schedule immediate processing using the abstraction
          const { enqueuePostJob } = await import("~/infra/queue");
          // Use 0 for immediate processing when timeDiff <= 1
          await enqueuePostJob(
            post.id,
            post.userId,
            post.signedEvent,
            timeDiff <= 0 ? 0 : scheduledTime,
          );
        }
      }

      // Process longform posts
      for (const longformPost of longformPosts) {
        if (!longformPost.userId || !longformPost.signedEvent || !longformPost.scheduledFor) continue;
        
        const scheduledTime = parseInt(longformPost.scheduledFor, 10);
        const timeDiff = scheduledTime - now;

        if (timeDiff <= 1) {
          // Schedule immediate processing using the abstraction
          const { enqueueLongFormPostJob } = await import("~/infra/queue");
          // Use 0 for immediate processing when timeDiff <= 1
          await enqueueLongFormPostJob(
            longformPost.id,
            longformPost.userId,
            longformPost.signedEvent,
            timeDiff <= 0 ? 0 : scheduledTime,
          );
        }
      }

      return { processed: posts.length + longformPosts.length };
    } catch (error) {
      console.error("Error checking scheduled posts:", error);
      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 1,
  },
);

// Start the recurring job to check for due posts every minute
async function startPostChecker() {
  // Set up recurring job directly (recurring jobs need direct queue access)
  await postCheckerQueue.add(
    "check-due-posts",
    {},
    {
      repeat: { every: 60000 }, // Every 60 seconds
      removeOnComplete: 1,
      removeOnFail: 1,
    },
  );
}

// Initialize the post checker
startPostChecker().catch(console.error);

// Graceful shutdown
process.on("SIGTERM", async () => {
  await scheduledPostsWorker.close();
  await scheduledLongFormPostsWorker.close();
  await postCheckerWorker.close();
  await closeAllQueues();
});

process.on("SIGINT", async () => {
  await scheduledPostsWorker.close();
  await scheduledLongFormPostsWorker.close();
  await postCheckerWorker.close();
  await closeAllQueues();
});

// Re-export queue operations for backward compatibility during migration
// These will be removed once all imports are updated
export {
  enqueuePostJob as schedulePost,
  cancelPostJob as cancelScheduledPost,
  enqueueLongFormPostJob as scheduleLongFormPost,
  cancelLongFormPostJob as cancelScheduledLongFormPost,
} from "~/infra/queue";
