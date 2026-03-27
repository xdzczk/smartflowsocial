/**
 * Settings loader data preparation
 * Centralized data fetching for settings page
 */

import {
  type PrimarySignerProfile,
  isPrimarySignerProfile,
} from "~/features/auth/signer";
import { listReplyTemplates } from "~/features/engagement/engagement-reply-templates.server";
import type { ProfileData } from "~/features/nostr/types";
import {
  getAllPlans,
  getUserPaymentHistory,
  getUserSubscription,
} from "~/features/payments/data";
import { getQueueAccentHex } from "~/features/posts/queue-colors";
import type {
  HashTagPreset,
  QueueType,
  ScheduleConfig,
} from "~/features/posts/types";
import { getReferralSettingsData } from "~/features/referral/referral-settings.server";
import { BLASTR_KNOWN_SYSTEM_RELAYS } from "~/features/relays/relay-constants";
import type { ManagedRelay } from "~/features/relays/relay-resolution.server";
import { getEffectiveWriteRelays } from "~/features/relays/relay-resolution.server";
import {
  getConfirmedChildrenForParent,
  getGiveawayBlacklist,
  getPendingChildrenForParent,
  getShowHashTagsInPosts,
  getUserBasicInfo,
  getUserBlastrRelayEnabled,
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
  getUserPolicy as getBlastrUserPolicy,
  resolvePubkeyHex as resolveBlastrPubkeyHex,
} from "~/infra/blastr/blastr-admin.client.server";

import { findLatestPublishRelayAcksByUserAndUrls } from "./repositories/settings-loader-data.server";

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
    renewalMode?: string;
    billingCadence?: string;
    accessDurationMonths?: number;
    billingPaymentMethod?: string;
    renewalFailureCount?: number;
    lastRenewalAttemptAt?: Date | null;
    nextRenewalAttemptAt?: Date | null;
    gracePeriodEndsAt?: Date | null;
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
  blastrRelayEnabled: boolean;
  canToggleBlastr: boolean;
  blastrPolicy: {
    policy: { mode: "blacklist" | "whitelist"; enabled: boolean } | null;
    relays: Array<{ relay_url: string; action: "allow" | "block" }>;
  } | null;
  blastrSystemRelays: string[];
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

async function buildAccountsData(params: {
  userRecord: { isChild?: boolean | null; parentNpub?: string | null };
  myNpub: string;
}): Promise<SettingsLoaderData["accounts"]> {
  const isChild = !!params.userRecord.isChild;
  if (isChild) {
    const parentUser = params.userRecord.parentNpub
      ? await getUserByNpubWithProfile(params.userRecord.parentNpub)
      : null;
    return {
      isChild: true,
      parentNpub: parentUser?.npub ?? null,
      parentUser: parentUser
        ? {
            ...parentUser,
            id: parentUser.npub,
            nostrProfile: parentUser.nostrProfile,
          }
        : null,
      confirmedChildren: [],
      pendingChildren: [],
    };
  }

  const parentNpub = params.myNpub;
  const [confirmedChildren, pendingChildren] = await Promise.all([
    parentNpub
      ? getConfirmedChildrenForParent(parentNpub)
      : Promise.resolve([]),
    parentNpub ? getPendingChildrenForParent(parentNpub) : Promise.resolve([]),
  ]);
  return {
    isChild: false,
    parentNpub,
    parentUser: null,
    confirmedChildren,
    pendingChildren,
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
    blastrRelayEnabled,
  ] = await Promise.all([
    getUserTimezone(userId),
    getRelayIntentCached(userId),
    getEffectiveWriteRelays(userId),
    getGiveawayBlacklist(userId),
    getShowHashTagsInPosts(userId),
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
    getUserBlastrRelayEnabled(userId),
  ]);

  const relays = relayIntent.writeRelays;
  const managedRelays = effectiveWriteRelays.managed;
  const uploadProvider = uploadProviderSettings.provider;
  const customBlossomUrl = uploadProviderSettings.customBlossomUrl;

  // Latest ACK per relay (best-effort). Include managed relay URL even if disabled.
  const ackRelayUrls = Array.from(
    new Set([...relays, ...managedRelays.map((m) => m.relayUrl)])
  );
  const ackRows =
    ackRelayUrls.length > 0
      ? await findLatestPublishRelayAcksByUserAndUrls(userId, ackRelayUrls)
      : [];

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

  const accounts = await buildAccountsData({
    userRecord: userRecord ?? { isChild: false, parentNpub: null },
    myNpub,
  });

  // Get subscription and referral information
  const [subscription, allPlans, paymentHistory, referral] = await Promise.all([
    getUserSubscription(userId),
    getAllPlans(),
    getUserPaymentHistory(userId),
    getReferralSettingsData(myNpub),
  ]);

  const canToggleBlastr = !!(
    subscription?.status === "ACTIVE" && subscription.Plan?.enableRelayBlast
  );
  let blastrPolicy: SettingsLoaderData["blastrPolicy"] = null;
  if (canToggleBlastr && myNpub) {
    const pubkeyHex = resolveBlastrPubkeyHex(myNpub);
    if (pubkeyHex) {
      const policyRes = await getBlastrUserPolicy(pubkeyHex);
      if (policyRes) {
        blastrPolicy = {
          policy: policyRes.policy,
          relays: policyRes.relays,
        };
      }
    }
  }
  const blastrSystemRelays = BLASTR_KNOWN_SYSTEM_RELAYS;

  return {
    timezone,
    relays,
    managedRelays,
    relayAcks,
    showHashTagsInPosts,
    giveawayBlacklist,
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
          renewalMode:
            typeof (subscription as unknown as { renewalMode?: unknown })
              .renewalMode === "string"
              ? (subscription as unknown as { renewalMode: string }).renewalMode
              : undefined,
          billingCadence:
            typeof (subscription as unknown as { billingCadence?: unknown })
              .billingCadence === "string"
              ? (subscription as unknown as { billingCadence: string })
                  .billingCadence
              : undefined,
          accessDurationMonths:
            typeof (
              subscription as unknown as { accessDurationMonths?: unknown }
            ).accessDurationMonths === "number"
              ? (subscription as unknown as { accessDurationMonths: number })
                  .accessDurationMonths
              : undefined,
          billingPaymentMethod:
            typeof (subscription as unknown as { paymentMethod?: unknown })
              .paymentMethod === "string"
              ? (subscription as unknown as { paymentMethod: string })
                  .paymentMethod
              : undefined,
          renewalFailureCount:
            typeof (
              subscription as unknown as { renewalFailureCount?: unknown }
            ).renewalFailureCount === "number"
              ? (subscription as unknown as { renewalFailureCount: number })
                  .renewalFailureCount
              : undefined,
          lastRenewalAttemptAt:
            (subscription as unknown as { lastRenewalAttemptAt?: Date | null })
              .lastRenewalAttemptAt ?? null,
          nextRenewalAttemptAt:
            (subscription as unknown as { nextRenewalAttemptAt?: Date | null })
              .nextRenewalAttemptAt ?? null,
          gracePeriodEndsAt:
            (subscription as unknown as { gracePeriodEndsAt?: Date | null })
              .gracePeriodEndsAt ?? null,
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
    blastrRelayEnabled,
    canToggleBlastr,
    blastrPolicy,
    blastrSystemRelays,
    referral,
  };
}
