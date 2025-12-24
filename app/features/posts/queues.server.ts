import { Queue, Worker, Job } from "bullmq";
import Redis from "ioredis";

import {
  updateLongFormPostStatus,
  getCronDueScheduledLongFormPosts,
} from "~/models/longformpost.server";
import {
  updatePostStatus,
  getCronDueScheduledPosts,
} from "~/models/post.server";
import { getUserById } from "~/models/user.server";

// Redis connection with BullMQ required config
const redis = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});

// Queue for scheduled posts
export const scheduledPostsQueue = new Queue("scheduled-posts", {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

// Queue for scheduled longform posts
export const scheduledLongFormPostsQueue = new Queue(
  "scheduled-longform-posts",
  {
    connection: redis,
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  },
);

// Job data interface
interface PostJobData {
  postId: string;
  userId: string;
  signedEvent: any;
}

// LongForm Job data interface
interface LongFormPostJobData {
  postId: string;
  userId: string;
  signedEvent: any;
}

// Worker to process scheduled posts
export const scheduledPostsWorker = new Worker<PostJobData>(
  "scheduled-posts",
  async (job: Job<PostJobData>) => {
    const { postId, userId, signedEvent } = job.data;

    try {
      // Update post status to posted
      await updatePostStatus({
        id: postId,
        userId: userId,
        isPosted: true,
      });

      // Get user relays
      const { userRelays } = await getUserById(userId);
      const sanitizedRelays = userRelays.map((relay) => relay.trim());

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
      // Update longform post status to published
      await updateLongFormPostStatus({
        id: postId,
        userId: userId,
        isPublished: true,
      });

      // Get user relays
      const { userRelays } = await getUserById(userId);
      const sanitizedRelays = userRelays.map((relay) => relay.trim());

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

// Function to schedule a post
export async function schedulePost(
  postId: string,
  userId: string,
  signedEvent: any,
  scheduledFor: number,
) {
  const delay = scheduledFor * 1000 - Date.now();

  if (delay <= 0) {
    throw new Error("Scheduled time must be in the future");
  }

  await scheduledPostsQueue.add(
    "publish-post",
    { postId, userId, signedEvent },
    { delay },
  );
}

// Function to cancel a scheduled post
export async function cancelScheduledPost(postId: string) {
  const jobs = await scheduledPostsQueue.getJobs(["waiting", "delayed"]);
  const job = jobs.find((j) => j.data.postId === postId);

  if (job) {
    await job.remove();
    return true;
  }

  return false;
}

// Function to schedule a longform post
export async function scheduleLongFormPost(
  postId: string,
  userId: string,
  signedEvent: any,
  scheduledFor: number,
) {
  const delay = scheduledFor * 1000 - Date.now();

  if (delay <= 0) {
    throw new Error("Scheduled time must be in the future");
  }

  await scheduledLongFormPostsQueue.add(
    "publish-longform-post",
    { postId, userId, signedEvent },
    { delay },
  );
}

// Function to cancel a scheduled longform post
export async function cancelScheduledLongFormPost(postId: string) {
  const jobs = await scheduledLongFormPostsQueue.getJobs([
    "waiting",
    "delayed",
  ]);
  const job = jobs.find((j) => j.data.postId === postId);

  if (job) {
    await job.remove();
    return true;
  }

  return false;
}

// Background job to check for due scheduled posts
export const postCheckerQueue = new Queue("post-checker", {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 10,
  },
});

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
        const scheduledTime = parseInt(post.scheduledFor, 10);
        const timeDiff = scheduledTime - now;

        if (timeDiff <= 1) {
          // Schedule immediate processing
          await scheduledPostsQueue.add(
            "publish-post",
            {
              postId: post.id,
              userId: post.userId,
              signedEvent: post.signedEvent,
            },
            { delay: 0 },
          );
        }
      }

      // Process longform posts
      for (const longformPost of longformPosts) {
        const scheduledTime = parseInt(longformPost.scheduledFor, 10);
        const timeDiff = scheduledTime - now;

        if (timeDiff <= 1) {
          // Schedule immediate processing
          await scheduledLongFormPostsQueue.add(
            "publish-longform-post",
            {
              postId: longformPost.id,
              userId: longformPost.userId,
              signedEvent: longformPost.signedEvent,
            },
            { delay: 0 },
          );
        }
      }

      const readyPosts = posts.filter(
        (p) => parseInt(p.scheduledFor, 10) - now <= 1,
      ).length;
      const readyLongformPosts = longformPosts.filter(
        (p) => parseInt(p.scheduledFor, 10) - now <= 1,
      ).length;

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
  await redis.quit();
});

process.on("SIGINT", async () => {
  await scheduledPostsWorker.close();
  await scheduledLongFormPostsWorker.close();
  await postCheckerWorker.close();
  await redis.quit();
});
