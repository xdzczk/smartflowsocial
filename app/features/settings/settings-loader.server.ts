/**
 * Settings loader data preparation
 * Centralized data fetching for settings page
 */

import { listReplyTemplates } from "~/features/engagement/engagement-reply-templates.server";
import type { ProfileData } from "~/features/nostr/types";
import { getQueueAccentHex } from "~/features/posts/queue-colors";
import type {
  HashTagPreset,
  QueueType,
  ScheduleConfig,
} from "~/features/posts/types";
import { getReferralSettingsData } from "~/features/referral/referral-settings.server";
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
  getUserPrimarySignerProfile,
  getResolvedUploadProviderSettings,
  getUserTimeFormat,
  getUserDateFormat,
  getUserPreferredNostrClient,
  getUserCustomNostrClientBaseUrl,
  getUserTimezone,
  getQueueTypes,
} from "~/features/user";
import {
  getRelayIntentCached,
  getHashTagPresetsCached,
} from "~/features/user/services/user-cache.server";
import {
  type PrimarySignerProfile,
  isPrimarySignerProfile,
} from "~/lib/primary-signer-profile";
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
  customBlossomUrl: string | null;
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
  replyTemplates: Array<{ id: string; slug: string; body: string }>;
  pushNotificationsEnabled: boolean;
  pushNotifyPublishSuccess: boolean;
  pushNotifyPublishFailure: boolean;
  pushNotifyRunwayLow: boolean;
  pushNotifyIncludePreview: boolean;
  runwayNotifyBelowDays: number | null;
  timeFormat: "12h" | "24h";
  dateFormat: "ddmmyyyy" | "mmddyyyy" | "yyyymmdd";
  preferredNostrClient: string;
  customNostrClientBaseUrl: string | null;
  primarySignerProfile: PrimarySignerProfile | null;
  referral: {
    referralLink: string;
    commissionRatePercent: number;
    totalEarnedSats: number;
    paidSats: number;
    pendingSats: number;
    failedSats: number;
    payoutDestination: string | null;
    payoutDestinationType: string | null;
  };
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
    uploadProviderSettings,
    enableMirrorBlossom,
    mirrorUploadUrls,
    hashTagPresets,
    nwcSettings,
    mutedList,
    replyTemplates,
    filterMuted,
    hidePostsFromLowTrustUsers,
    pushNotificationPreferences,
    timeFormat,
    dateFormat,
    preferredNostrClient,
    customNostrClientBaseUrl,
    primarySignerProfile,
  ] = await Promise.all([
    getUserTimezone(userId),
    getRelayIntentCached(userId),
    getEffectiveWriteRelays(userId),
    getGiveawayBlacklist(userId),
    getShowHashTagsInPosts(userId),
    getScheduleInterval(userId),
    getQueueTypes(userId),
    getResolvedUploadProviderSettings(userId),
    getUserEnableMirrorBlossom(userId),
    getUserMirrorUploadUrls(userId),
    getHashTagPresetsCached(userId),
    getUserNWC(userId),
    getUserMutedList(userId),
    listReplyTemplates(userId),
    getUserFilterMuted(userId),
    getUserHidePostsFromLowTrustUsers(userId),
    getUserPushNotificationPreferences(userId),
    getUserTimeFormat(userId),
    getUserDateFormat(userId),
    getUserPreferredNostrClient(userId),
    getUserCustomNostrClientBaseUrl(userId),
    getUserPrimarySignerProfile(userId),
  ]);

  const relays = relayIntent.writeRelays;
  const managedRelays = effectiveWriteRelays.managed;
  const uploadProvider = uploadProviderSettings.provider;
  const customBlossomUrl = uploadProviderSettings.customBlossomUrl;

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

  // Get subscription and referral information
  const [subscription, allPlans, paymentHistory, referral] = await Promise.all([
    getUserSubscription(userId),
    getAllPlans(),
    getUserPaymentHistory(userId),
    getReferralSettingsData(myNpub),
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
      color: getQueueAccentHex(qt.colorToken ?? null),
      colorToken: qt.colorToken ?? undefined,
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
    customBlossomUrl,
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
    replyTemplates,
    filterMuted,
    hidePostsFromLowTrustUsers,
    pushNotificationsEnabled:
      pushNotificationPreferences.pushNotificationsEnabled,
    pushNotifyPublishSuccess:
      pushNotificationPreferences.pushNotifyPublishSuccess,
    pushNotifyPublishFailure:
      pushNotificationPreferences.pushNotifyPublishFailure,
    pushNotifyRunwayLow: pushNotificationPreferences.pushNotifyRunwayLow,
    pushNotifyIncludePreview:
      pushNotificationPreferences.pushNotifyIncludePreview,
    runwayNotifyBelowDays: pushNotificationPreferences.runwayNotifyBelowDays,
    timeFormat,
    dateFormat,
    preferredNostrClient,
    customNostrClientBaseUrl,
    primarySignerProfile: isPrimarySignerProfile(primarySignerProfile)
      ? primarySignerProfile
      : null,
    referral,
  };
}
