/**
 * Settings loader data preparation
 * Centralized data fetching for settings page
 */

import type { ProfileData } from "~/features/nostr/types";
import type {
  HashTagPreset,
  QueueType,
  ScheduleConfig,
} from "~/features/posts/types";
import type { ManagedRelay } from "~/features/relays/relay-resolution.server";
import { getEffectiveWriteRelays } from "~/features/relays/relay-resolution.server";
import {
  getConfirmedChildrenForParent,
  getGiveawayBlacklist,
  getPendingChildrenForParent,
  getScheduleInterval,
  getShowHashTagsInPosts,
  getUserBasicInfo,
  getUserByNpubWithProfile,
  getUserEnableMirrorBlossom,
  getUserFilterMuted,
  getUserHidePostsFromLowTrustUsers,
  getUserMirrorUploadUrls,
  getUserMutedList,
  getUserNWC,
  getUserPushNotificationPreferences,
  getUserTimezone,
  getUserUploadProvider,
} from "~/features/user";
import {
  getRelayIntentCached,
  getQueueTypesCached,
  getHashTagPresetsCached,
} from "~/features/user/services/user-cache.server";
import { prisma } from "~/lib/prisma.server";
import {
  getAllPlans,
  getUserPaymentHistory,
  getUserSubscription,
} from "~/models/payment.server";

/**
 * User account info for parent/child relationships
 */
export interface UserAccountInfo {
  id: string;
  npub: string;
  name?: string | null;
  picture?: string | null;
  pubKey?: string;
}

/**
 * Muted list structure
 */
export interface MutedList {
  users?: string[];
  keywords?: string[];
  [key: string]: unknown;
}

export interface SettingsLoaderData {
  timezone: string | null;
  relays: string[];
  managedRelays: ManagedRelay[];
  relayAcks: Record<
    string,
    { status: string; createdAt: string; receivedAt: string | null }
  >;
  showHashTagsInPosts: boolean;
  giveawayBlacklist: string[];
  scheduleIntervals: string[];
  queueTypes: QueueType[];
  uploadProvider: string;
  enableMirrorBlossom: boolean;
  mirrorUploadUrls: string[];
  hashTagPresets: HashTagPreset[];
  nwcEnabled: boolean;
  maskedNwcString: string | null;
  nwcLastUsed: Date | null;
  subscription: {
    id: string;
    planId: string | null;
    status: string;
    startDate: Date;
    currentPeriodEnd: Date | null;
    nextPaymentDue: Date | null;
    cancelAtPeriodEnd: boolean;
    plan: {
      id: string;
      name: string;
      price: number;
      enableLifetimeAccess: boolean;
    } | null;
  } | null;
  availablePlans: Array<{
    id: string;
    name: string;
    price: number;
    enableLifetimeAccess: boolean;
  }>;
  paymentHistory: Array<{
    id: string;
    amount: number;
    amountUsd: number | null;
    description: string | null;
    paidAt: Date | null;
    paymentMethod: string | null;
    paymentHash: string;
    planName?: string;
    planPrice?: number;
  }>;
  isChild: boolean;
  hasAccountsAccess: boolean;
  accounts: {
    isChild: boolean;
    parentNpub: string | null;
    parentUser:
      | (UserAccountInfo & { nostrProfile?: ProfileData | null })
      | null;
    confirmedChildren: UserAccountInfo[];
    pendingChildren: UserAccountInfo[];
  };
  mutedList: MutedList | null;
  filterMuted: boolean;
  hidePostsFromLowTrustUsers: boolean;
  pushNotificationsEnabled: boolean;
  pushNotifyPublishSuccess: boolean;
  pushNotifyPublishFailure: boolean;
}

/**
 * Load all settings data
 */
export async function loadSettingsData(
  userId: string
): Promise<SettingsLoaderData> {
  // Get subscription and plan name for gating Accounts tab
  const currentSub = await getUserSubscription(userId);
  const planName = currentSub?.Plan?.name ?? null;

  const userRecord = await getUserBasicInfo(userId);
  const myNpub = userRecord?.npub as string;
  const isChild = !!userRecord?.isChild;
  const hasAccountsAccess =
    isChild || planName === "Founder" || planName === "Premium";

  // Load all settings data in parallel
  // Use cached versions for rarely-changing data (queue types, hashtag presets, relay intent)
  const [
    timezone,
    relayIntent,
    effectiveWriteRelays,
    giveawayBlacklist,
    showHashTagsInPosts,
    scheduleIntervals,
    queueTypes,
    uploadProvider,
    enableMirrorBlossom,
    mirrorUploadUrls,
    hashTagPresets,
    nwcSettings,
    mutedList,
    filterMuted,
    hidePostsFromLowTrustUsers,
    pushNotificationPreferences,
  ] = await Promise.all([
    getUserTimezone(userId),
    getRelayIntentCached(userId),
    getEffectiveWriteRelays(userId),
    getGiveawayBlacklist(userId),
    getShowHashTagsInPosts(userId),
    getScheduleInterval(userId),
    getQueueTypesCached(userId),
    getUserUploadProvider(userId),
    getUserEnableMirrorBlossom(userId),
    getUserMirrorUploadUrls(userId),
    getHashTagPresetsCached(userId),
    getUserNWC(userId),
    getUserMutedList(userId),
    getUserFilterMuted(userId),
    getUserHidePostsFromLowTrustUsers(userId),
    getUserPushNotificationPreferences(userId),
  ]);

  const relays = relayIntent.writeRelays;
  const managedRelays = effectiveWriteRelays.managed;

  // Latest ACK per relay (best-effort). Include managed relay URL even if disabled.
  const ackRelayUrls = Array.from(
    new Set([...relays, ...managedRelays.map((m) => m.relayUrl)])
  );
  let ackRows: Array<{
    relayUrl: string;
    status: string;
    createdAt: Date;
    receivedAt: Date | null;
  }> = [];
  if (ackRelayUrls.length > 0) {
    try {
      ackRows = await prisma.publishRelayAck.findMany({
        where: { userId, relayUrl: { in: ackRelayUrls } },
        orderBy: { createdAt: "desc" },
        distinct: ["relayUrl"],
      });
    } catch {
      // Best-effort: if the ACK table isn't available yet (e.g. migrations not applied),
      // do not break the settings page.
      ackRows = [];
    }
  }

  const relayAcks: SettingsLoaderData["relayAcks"] = Object.fromEntries(
    ackRows.map((row) => [
      row.relayUrl,
      {
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        receivedAt: row.receivedAt ? row.receivedAt.toISOString() : null,
      },
    ])
  );

  // Accounts data
  let accounts: SettingsLoaderData["accounts"];
  if (isChild) {
    const parentUser = userRecord.parentNpub
      ? await getUserByNpubWithProfile(userRecord.parentNpub)
      : null;
    accounts = {
      isChild: true,
      parentNpub: parentUser?.npub ?? null,
      parentUser: parentUser
        ? {
            ...parentUser,
            id: parentUser.npub, // Add required id field
            nostrProfile: parentUser.nostrProfile,
          }
        : null,
      confirmedChildren: [],
      pendingChildren: [],
    };
  } else {
    const parentNpub = myNpub;
    const [confirmedChildren, pendingChildren] = await Promise.all([
      parentNpub
        ? getConfirmedChildrenForParent(parentNpub)
        : Promise.resolve([]),
      parentNpub
        ? getPendingChildrenForParent(parentNpub)
        : Promise.resolve([]),
    ]);
    accounts = {
      isChild: false,
      parentNpub,
      parentUser: null,
      confirmedChildren,
      pendingChildren,
    };
  }

  // Get subscription information
  const [subscription, allPlans, paymentHistory] = await Promise.all([
    getUserSubscription(userId),
    getAllPlans(),
    getUserPaymentHistory(userId),
  ]);

  return {
    timezone,
    relays,
    managedRelays,
    relayAcks,
    showHashTagsInPosts,
    giveawayBlacklist,
    scheduleIntervals,
    queueTypes: queueTypes.map((qt) => ({
      id: qt.id,
      name: qt.name,
      color: qt.color,
      description: qt.description,
      scheduleType: qt.scheduleType,
      scheduleConfig:
        qt.scheduleConfig &&
        typeof qt.scheduleConfig === "object" &&
        !Array.isArray(qt.scheduleConfig)
          ? (qt.scheduleConfig as ScheduleConfig)
          : undefined,
      isEnabled: qt.isEnabled,
      userId: qt.userId,
    })),
    uploadProvider,
    enableMirrorBlossom,
    mirrorUploadUrls,
    hashTagPresets: hashTagPresets as unknown as typeof hashTagPresets,
    nwcEnabled: nwcSettings.enabled,
    maskedNwcString: nwcSettings.maskedString ?? null,
    nwcLastUsed: nwcSettings.lastUsed ?? null,
    subscription: subscription
      ? {
          id: subscription.id,
          planId: subscription.planId ?? null,
          status: subscription.status as string,
          startDate: subscription.startDate,
          currentPeriodEnd: subscription.currentPeriodEnd,
          nextPaymentDue: subscription.nextPaymentDue,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          plan: subscription.Plan
            ? {
                id: subscription.Plan.id,
                name: subscription.Plan.name,
                price: Number(subscription.Plan.price),
                enableLifetimeAccess: subscription.Plan.enableLifetimeAccess,
              }
            : null,
        }
      : null,
    availablePlans: allPlans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      price: Number(plan.price),
      enableLifetimeAccess: plan.enableLifetimeAccess,
    })),
    paymentHistory: paymentHistory.map((payment) => ({
      id: payment.id,
      amount: payment.amount,
      amountUsd: payment.amountUsd ? Number(payment.amountUsd) : null,
      description: payment.description,
      paidAt: payment.paidAt,
      paymentMethod: payment.paymentMethod,
      paymentHash: payment.paymentHash || "",
      planName: payment.Subscription?.Plan?.name,
      planPrice: payment.Subscription?.Plan?.price
        ? Number(payment.Subscription.Plan.price)
        : undefined,
    })),
    isChild,
    hasAccountsAccess,
    accounts,
    mutedList,
    filterMuted,
    hidePostsFromLowTrustUsers,
    pushNotificationsEnabled:
      pushNotificationPreferences.pushNotificationsEnabled,
    pushNotifyPublishSuccess:
      pushNotificationPreferences.pushNotifyPublishSuccess,
    pushNotifyPublishFailure:
      pushNotificationPreferences.pushNotifyPublishFailure,
  };
}
