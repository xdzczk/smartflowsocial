import {
  createPendingAttempt,
  markAttemptFailed,
  markAttemptSent,
  resolveDedupeForIntent,
} from "~/features/payments/repositories/subscription-notification.repository.server";
import type { BillingNotificationCommMode } from "~/features/payments/types/subscription-billing.types";
import { logError, logInfo } from "~/lib/error-logger.server";
import { sendNostrDirectMessage } from "~/lib/nostr.messenger.server";
import { trackProductEvent } from "~/lib/product-events.server";

import { buildSubscriptionNotificationMessage } from "./subscription-notification-copy.server";
import type { SubscriptionNotificationEventType } from "./subscription-notification-types";

function buildDeliveryMeta(
  result: Awaited<ReturnType<typeof sendNostrDirectMessage>>
): Record<string, unknown> {
  if (result === false) {
    return {
      nip04: { success: false },
      nip17: { attempted: false, recipientPublished: false },
      error: "sendNostrDirectMessage returned false",
    };
  }
  return {
    nip04: result.nip04,
    nip17: result.nip17,
    success: result.success,
    error: result.error,
    status: result.status,
  };
}

export async function deliverSubscriptionNotificationDm(params: {
  userId: string;
  npub: string;
  subscriptionId: string;
  planId: string | null;
  eventType: SubscriptionNotificationEventType;
  commMode: BillingNotificationCommMode;
  dedupeKey: string;
  currentPeriodEnd: Date | null;
  gracePeriodEndsAt: Date | null;
}): Promise<{ ok: boolean; skipped?: boolean }> {
  const {
    userId,
    npub,
    subscriptionId,
    planId,
    eventType,
    commMode,
    dedupeKey,
    currentPeriodEnd,
    gracePeriodEndsAt,
  } = params;

  const resolution = await resolveDedupeForIntent(dedupeKey);
  if (resolution.action === "skip") {
    return { ok: true, skipped: true };
  }

  let attemptId: string;
  if (resolution.action === "create") {
    const row = await createPendingAttempt({
      userId,
      subscriptionId,
      planId,
      eventType,
      commMode,
      dedupeKey,
    });
    attemptId = row.id;
  } else {
    attemptId = resolution.attemptId;
  }

  const content = buildSubscriptionNotificationMessage({
    eventType,
    commMode,
    currentPeriodEnd,
    gracePeriodEndsAt,
  });

  const sendResult = await sendNostrDirectMessage(npub, content);
  const meta = buildDeliveryMeta(sendResult);
  const success =
    sendResult !== false &&
    typeof sendResult === "object" &&
    sendResult.success === true;

  if (success) {
    await markAttemptSent(attemptId, meta);
    trackProductEvent("notification_dm_sent", {
      userId,
      subscriptionId,
      eventType,
      commMode,
    });
    logInfo("Subscription billing DM sent", {
      userId,
      npub,
      subscriptionId,
      eventType,
      commMode,
      nip17: meta["nip17"],
      nip04: meta["nip04"],
    });
    return { ok: true };
  }

  const failureReason =
    sendResult === false
      ? "sendNostrDirectMessage returned false"
      : typeof sendResult === "object" && sendResult.error
        ? sendResult.error
        : "DM send failed";

  await markAttemptFailed(attemptId, failureReason, meta);
  trackProductEvent("notification_dm_failed", {
    userId,
    subscriptionId,
    eventType,
    commMode,
    failureReason,
  });
  logError(new Error(failureReason), {
    message: "Subscription billing DM failed",
    userId,
    npub,
    subscriptionId,
    eventType,
    commMode,
    nip17: meta["nip17"],
    nip04: meta["nip04"],
    relaySummary: meta,
  });
  return { ok: false };
}
