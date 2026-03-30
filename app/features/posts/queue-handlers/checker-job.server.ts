/**
 * Post checker job: finds due scheduled posts and longform posts, enqueues them.
 * Exports runPostChecker() used by the post-checker worker.
 */

import { processDueScheduledContestLaunches } from "~/features/contest";
import { processLongFormPost } from "~/features/posts/queue-handlers/longform-job.server";
import { processPost } from "~/features/posts/queue-handlers/post-job.server";
import { extractPostData } from "~/features/posts/queue-payload.server";
import {
  getCronDueScheduledLongFormPosts,
  getCronDueScheduledPosts,
} from "~/features/posts/server";

/**
 * Run the post checker: load due scheduled posts and longform posts, then for each
 * (skipping outbox-managed ones) extract post data and call processPost/processLongFormPost.
 * Returns the number of posts/longform posts that were successfully enqueued.
 */
export async function runPostChecker(): Promise<{ processed: number }> {
  const [posts, longformPosts] = await Promise.all([
    getCronDueScheduledPosts(),
    getCronDueScheduledLongFormPosts(),
  ]);
  const { nowSeconds } = await import("~/lib/temporal");
  const now = nowSeconds();

  let processed = 0;

  for (const post of posts) {
    if (
      typeof post === "object" &&
      "enqueueIdempotencyKey" in post &&
      typeof post.enqueueIdempotencyKey === "string" &&
      post.enqueueIdempotencyKey.length > 0
    ) {
      continue;
    }
    const postData = await extractPostData(post);
    if (postData) {
      const success = await processPost(postData, now);
      if (success) {
        processed++;
      }
    }
  }

  await processDueScheduledContestLaunches();

  for (const longformPost of longformPosts) {
    if (
      typeof longformPost === "object" &&
      "enqueueIdempotencyKey" in longformPost &&
      typeof longformPost.enqueueIdempotencyKey === "string" &&
      longformPost.enqueueIdempotencyKey.length > 0
    ) {
      continue;
    }
    const postData = await extractPostData(longformPost);
    if (postData) {
      const success = await processLongFormPost(postData, now);
      if (success) {
        processed++;
      }
    }
  }

  return { processed };
}
