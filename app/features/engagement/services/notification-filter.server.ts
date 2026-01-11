/**
 * Notification filtering service
 * Filters notifications by muted users and trust scores
 */

import type { Notification } from "../types";

/**
 * Filter notifications by muted users
 */
export function filterMutedNotifications(
  notifications: Notification[],
  mutedPubkeys: string[]
): Notification[] {
  return notifications.filter((notification) => {
    const pubkeyToCheck =
      notification.type === "zap"
        ? notification.senderPubkey
        : notification.pubkey;
    return !mutedPubkeys.includes(pubkeyToCheck);
  });
}

/**
 * Filter notifications by trust score
 */
export function filterLowTrustNotifications(
  notifications: Notification[],
  trustScoresMap: Map<string, number>
): Notification[] {
  return notifications.filter((notification) => {
    const pubkeyToCheck =
      notification.type === "zap"
        ? notification.senderPubkey
        : notification.pubkey;
    const trustScore = trustScoresMap.get(pubkeyToCheck);
    return trustScore === undefined || trustScore >= 40;
  });
}

/**
 * Apply all notification filters based on user preferences
 */
export function applyNotificationFilters(
  notifications: Notification[],
  options: {
    mutedPubkeys: string[];
    trustScoresMap: Map<string, number>;
    filterMuted: boolean;
    filterLowTrust: boolean;
  }
): Notification[] {
  let filtered = notifications;

  if (options.filterMuted && options.mutedPubkeys.length > 0) {
    filtered = filterMutedNotifications(filtered, options.mutedPubkeys);
  }

  if (options.filterLowTrust) {
    filtered = filterLowTrustNotifications(filtered, options.trustScoresMap);
  }

  return filtered;
}
