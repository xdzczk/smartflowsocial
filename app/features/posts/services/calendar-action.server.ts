/**
 * Calendar action handlers
 * Centralized action processing for calendar pages
 */

import { json } from "@remix-run/node";

import {
  cancelPostJob as cancelScheduledPost,
  enqueuePostJob as schedulePost,
} from "~/infra/queue";
import { logWarning } from "~/lib/error-logger.server";
import { assertSignedEventMatchesSessionPubkey } from "~/lib/nostr-session-invariants.server";
import {
  calendarRescheduleSchema,
  calendarRescheduleLongformSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";
import {
  getLongFormPost,
  updateLongFormPost,
} from "~/models/longformpost.server";
import { reschedulePost } from "~/models/post.commands.server";
import { getPostById } from "~/models/post.queries.server";

/**
 * Handle calendar reschedule action for regular posts
 */
export async function handleCalendarReschedule(
  formData: FormData,
  userId: string,
  sessionPubkey: string
) {
  const result = validateFormDataOrRespond(formData, calendarRescheduleSchema);
  if (!result.success) {
    return result.response;
  }

  const { postId, newTime, overrideQueue, signedEvent, nostrEvent } =
    result.data;

  // Get the original post
  const originalPost = await getPostById({ id: postId, userId });
  if (!originalPost) {
    return json({ error: "Post not found" }, { status: 404 });
  }

  // Cancel existing scheduled job
  await cancelScheduledPost(postId);

  // Parse signed events if provided (from client-side re-signing)
  let parsedSignedEvent = null;
  let parsedNostrEvent = null;

  if (signedEvent && nostrEvent) {
    try {
      parsedSignedEvent = JSON.parse(signedEvent) as {
        id: string;
        pubkey: string;
        created_at: number;
        kind: number;
        content: string;
        tags: string[][];
        sig: string;
      };
      parsedNostrEvent = JSON.parse(nostrEvent) as {
        id: string;
        pubkey: string;
        created_at: number;
        kind: number;
        content: string;
        tags: string[][];
      };
    } catch (e) {
      // Log parsing error but continue without signed events
      logWarning("Failed to parse signed events in reschedule", {
        postId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Update post in database
  const updatedPost = await reschedulePost({
    id: postId,
    userId,
    newScheduledFor: newTime,
    overrideQueue,
  });

  // If we have a newly signed event, update the post with it and schedule the job
  if (parsedSignedEvent && parsedNostrEvent) {
    assertSignedEventMatchesSessionPubkey({
      sessionPubkey,
      eventPubkey: parsedSignedEvent.pubkey,
      context: { feature: "calendar", action: "reschedule", postId },
    });

    // Update post with new signed event
    const finalPost = await reschedulePost({
      id: postId,
      userId,
      newScheduledFor: newTime,
      overrideQueue,
      signedEvent: parsedSignedEvent,
      nostrEvent: parsedNostrEvent,
    });

    // Schedule new job
    await schedulePost(postId, userId, parsedSignedEvent, parseInt(newTime));

    return json({ success: true, post: finalPost, signed: true });
  }

  // Return success but indicate signing is needed
  return json({ success: true, post: updatedPost, needsSigning: true });
}

/**
 * Handle calendar reschedule action for longform posts
 */
export async function handleCalendarRescheduleLongform(
  formData: FormData,
  userId: string,
  sessionPubkey: string
) {
  const result = validateFormDataOrRespond(
    formData,
    calendarRescheduleLongformSchema
  );
  if (!result.success) {
    return result.response;
  }

  const { postId, newTime, signedEvent, nostrEvent } = result.data;

  // Get the original longform post
  const originalPost = await getLongFormPost({ id: postId, userId });
  if (!originalPost) {
    return json({ error: "Longform post not found" }, { status: 404 });
  }

  // Parse signed events if provided (from client-side re-signing)
  let parsedSignedEvent = null;
  let parsedNostrEvent = null;

  if (signedEvent && nostrEvent) {
    try {
      parsedSignedEvent = JSON.parse(signedEvent) as {
        id: string;
        pubkey: string;
        created_at: number;
        kind: number;
        content: string;
        tags: string[][];
        sig: string;
      };
      parsedNostrEvent = JSON.parse(nostrEvent) as {
        id: string;
        pubkey: string;
        created_at: number;
        kind: number;
        content: string;
        tags: string[][];
      };
    } catch (e) {
      // Log parsing error but continue without signed events
      logWarning("Failed to parse signed events in reschedule", {
        postId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (parsedSignedEvent) {
    assertSignedEventMatchesSessionPubkey({
      sessionPubkey,
      eventPubkey: parsedSignedEvent.pubkey,
      context: { feature: "calendar", action: "rescheduleLongform", postId },
    });
  }

  // Update longform post in database
  const updatedPost = await updateLongFormPost({
    id: postId,
    userId,
    scheduledFor: newTime,
    signedEvent: parsedSignedEvent,
    nostrEvent: parsedNostrEvent,
  });

  return json({
    success: true,
    post: updatedPost,
    signed: !!parsedSignedEvent,
  });
}

/**
 * Handle calendar actions (routes to appropriate handler)
 */
export async function handleCalendarAction(
  formData: FormData,
  userId: string,
  sessionPubkey: string
) {
  const actionType = formData.get("action");

  if (actionType === "reschedule") {
    return handleCalendarReschedule(formData, userId, sessionPubkey);
  }

  if (actionType === "rescheduleLongform") {
    return handleCalendarRescheduleLongform(formData, userId, sessionPubkey);
  }

  return json({ error: "Invalid action" }, { status: 400 });
}
