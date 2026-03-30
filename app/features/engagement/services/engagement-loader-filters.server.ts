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
