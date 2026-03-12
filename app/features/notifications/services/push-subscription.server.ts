/**
 * Push Subscription Service
 * Service layer for push subscription operations
 */

import {
  upsertPushSubscription as upsertSubscription,
  getUserPushSubscriptions as getUserSubscriptions,
  deletePushSubscription as deleteSubscription,
} from "~/features/user/services/push-subscription.server";

export interface CreatePushSubscriptionInput {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Create or update push subscription
 */
export async function upsertPushSubscription(
  input: CreatePushSubscriptionInput
) {
  return upsertSubscription(input);
}

/**
 * Get all push subscriptions for a user
 */
export async function getUserPushSubscriptions(userId: string) {
  return getUserSubscriptions(userId);
}

/**
 * Delete push subscription by endpoint
 */
export async function deletePushSubscription(endpoint: string) {
  return deleteSubscription(endpoint);
}
