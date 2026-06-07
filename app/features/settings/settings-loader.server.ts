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
import { parseCommercialPlanType } from "~/features/payments/plan-mapping";
import {
  getSubscriptionData,
  isSubscriptionActiveForGating,
} from "~/features/payments/subscriptions.server";
import type { BillingContext } from "~/features/payments/types/subscription-billing.types";
import { getQueueAccentHex } from "~/features/posts/queue-colors";
import type { HashTagPreset, QueueType } from "~/features/posts/types";
import { getReferralSettingsData } from "~/features/referral/referral-settings.server";
import type { Nip65ProfileRelayEntry } from "~/features/relays/nip65-relay-entry";
import { BLASTR_KNOWN_SYSTEM_RELAYS } from "~/features/relays/relay-constants";
import type { ManagedRelay } from "~/features/relays/relay-resolution.server";
import {
  getEffectiveWriteRelays,
  loadRelaySettingsLoaderSlice,
} from "~/features/relays/relay-resolution.server";
import {
  getConfirmedChildrenForParent,
  getGiveawayBlacklist,
  getPendingChildrenForParent,
  getPendingParentRequestsForChild,
  getUserBasicInfo,
  getUsersByNpubs,
  getUserBlastrRelayEnabled,
  getUserByNpubWithProfile,
  getUserEnableMirrorBlossom,
  getUserFilterMuted,
  getUserHidePostsFromLowTrustUsers,
  getUserMirrorUploadUrls,
  getUserMutedList,
  getUserNWC,
  getUserPushNotificationPreferences,
  getUserThemePreference,
  getUserPrimarySignerProfile,
  getResolvedUploadProviderSettings,
  getUserTimeFormat,
  getUserDateFormat,
  getUserPreferredNostrClient,
  getUserCustomNostrClientBaseUrl,
  getUserTimezone,
  getQueueTypes,
  getUserDefaultZapAmountSatsStored,
  getScheduleInterval,
} from "~/features/user";
import { getHashTagPresetsCached } from "~/features/user/services/user-cache.server";
import {
  getUserPolicy as getBlastrUserPolicy,
  resolvePubkeyHex as resolveBlastrPubkeyHex,
} from "~/infra/blastr/blastr-admin.client.server";
import { logWarning } from "~/lib/error-logger.server";

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
  /** App relay list (editable); defaults applied when DB empty. */
  relays: string[];
  /** Which list is used for publishing: app list vs NIP-65 profile relays. */
  publishRelaySource: "app" | "nip65_profile";
  /** Write relays from latest kind 10002 for this npub (may be empty). */
  profileRelays: string[];
  /** Full NIP-65 `r` tag rows from kind 10002 (order preserved). */
  profileRelayEntries: Nip65ProfileRelayEntry[];
  managedRelays: ManagedRelay[];
  relayAcks: Record<
    string,
    { status: string; createdAt: string; receivedAt: string | null }
  >;
  giveawayBlacklist: string[];
  queueTypes: QueueTypeSettings[];
  /** User's global composer schedule intervals (hours), for queue row summaries when a queue uses global interval mode. */
  globalScheduleIntervalHours: number[];
  uploadProvider: string;
  /** DB preference after tier mapping; may differ from `uploadProvider` when SFS is stored but subscription inactive. */
  uploadProviderStored: string;
  /** True when paid subscription is active for gating (SFS, etc.). */
  isSubscriptionActiveForGating: boolean;
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
    /** Parents who requested to link this account (when not yet linked or same shape as dashboard). */
    pendingIncomingParents: UserAccountInfo[];
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
  /** Account-level appearance preference; null means no account override. */
  themePreference: "system" | "light" | "dark" | null;
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
  /** Persisted default zap (sats); null until user saves (UI uses fallback 21). */
  defaultZapAmountSats: number | null;
  billingContext: BillingContext | null;
}

type QueueTypeSettings = QueueType & {
  isDefault: boolean;
  hashTagPreset?: {
    id: string;
    name: string;
    tags: string;
    description?: string;
  } | null;
  hashTagPresetId?: string;
};

/** Safe defaults when settings loader fails (matches dashboard.settings error fallback). */
export const SETTINGS_LOADER_FALLBACK: SettingsLoaderData = {
  timezone: "Etc/GMT",
  relays: [],
  publishRelaySource: "nip65_profile",
  profileRelays: [],
  profileRelayEntries: [],
  managedRelays: [],
  relayAcks: {},
  giveawayBlacklist: [],
  queueTypes: [],
  globalScheduleIntervalHours: [],
  uploadProvider: "",
  uploadProviderStored: "",
  isSubscriptionActiveForGating: false,
  customBlossomUrl: null,
  enableMirrorBlossom: false,
  mirrorUploadUrls: [],
  hashTagPresets: [],
  nwcEnabled: false,
  maskedNwcString: null,
  nwcLastUsed: null,
  subscription: null,
  availablePlans: [],
  paymentHistory: [],
  isChild: false,
  hasAccountsAccess: false,
  accounts: {
    isChild: false,
    parentNpub: null,
    parentUser: null,
    confirmedChildren: [],
    pendingChildren: [],
    pendingIncomingParents: [],
  },
  mutedList: { npubs: [], lastSynced: new Date().toISOString() },
  filterMuted: false,
  hidePostsFromLowTrustUsers: false,
  replyTemplates: [],
  pushNotificationsEnabled: false,
  pushNotifyPublishSuccess: false,
  pushNotifyPublishFailure: false,
  pushNotifyRunwayLow: false,
  pushNotifyIncludePreview: false,
  runwayNotifyBelowDays: null,
  timeFormat: "12h",
  dateFormat: "mmddyyyy",
  preferredNostrClient: "",
  customNostrClientBaseUrl: null,
  primarySignerProfile: null,
  blastrRelayEnabled: true,
  themePreference: null,
  canToggleBlastr: false,
  blastrPolicy: null,
  blastrSystemRelays: [],
  referral: {
    referralLink: "",
    commissionRatePercent: 20,
    totalEarnedSats: 0,
    paidSats: 0,
    pendingSats: 0,
    failedSats: 0,
    payoutDestination: null,
    payoutDestinationType: null,
  },
  defaultZapAmountSats: null,
  billingContext: null,
};

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
      pendingIncomingParents: [],
    };
  }

  const parentNpub = params.myNpub;
  const [confirmedChildren, pendingChildren, pendingParentHexes] =
    await Promise.all([
      parentNpub
        ? getConfirmedChildrenForParent(parentNpub)
        : Promise.resolve([]),
      parentNpub
        ? getPendingChildrenForParent(parentNpub)
        : Promise.resolve([]),
      parentNpub
        ? getPendingParentRequestsForChild(parentNpub)
        : Promise.resolve([]),
    ]);
  const pendingIncomingParentsRaw = await getUsersByNpubs(pendingParentHexes);
  const pendingIncomingParents = pendingIncomingParentsRaw.map((u) => ({
    id: u.npub,
    npub: u.npub,
    nostrProfile: u.nostrProfile ?? null,
  })) as UserAccountInfo[];
  return {
    isChild: false,
    parentNpub,
    parentUser: null,
    confirmedChildren,
    pendingChildren,
    pendingIncomingParents,
  };
}

/** Dedupe and sort global composer interval hours from persisted string[] (e.g. "8", "0.25"). */
function normalizeGlobalScheduleIntervalHours(raw: string[]): number[] {
  const nums = raw
    .map((s) => Number.parseFloat(String(s).trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return [...new Set(nums)].sort((a, b) => a - b);
}

/**
 * Load all settings data
 */
export async function loadSettingsData(
  userId: string
): Promise<SettingsLoaderData> {
  const EMPTY_REFERRAL: SettingsLoaderData["referral"] = {
    referralLink: "",
    commissionRatePercent: 20,
    totalEarnedSats: 0,
    paidSats: 0,
    pendingSats: 0,
    failedSats: 0,
    payoutDestination: null,
    payoutDestinationType: null,
  };

  // Load all settings data in parallel
  // Use cached versions for rarely-changing data (queue types, hashtag presets)
  const [
    timezone,
    relaySlice,
    giveawayBlacklist,
    queueTypes,
    uploadProviderSettings,
    isSubscriptionActiveForGatingValue,
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
    themePreference,
    defaultZapAmountSats,
    scheduleIntervalStrings,
    subscription,
    userRecord,
  ] = await Promise.all([
    getUserTimezone(userId),
    loadRelaySettingsLoaderSlice(userId),
    getGiveawayBlacklist(userId),
    getQueueTypes(userId),
    getResolvedUploadProviderSettings(userId),
    isSubscriptionActiveForGating(userId),
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
    getUserThemePreference(userId),
    getUserDefaultZapAmountSatsStored(userId),
    getScheduleInterval(userId),
    getUserSubscription(userId),
    getUserBasicInfo(userId),
  ]);

  const myNpub = userRecord?.npub ?? "";
  const isChild = !!userRecord?.isChild;

  const planName = subscription?.Plan?.name ?? "";
  const planId = (subscription?.planId ?? "").toLowerCase();
  const parsedPlanType = parseCommercialPlanType(planId || planName);
  if (!parsedPlanType && (planId || planName)) {
    logWarning("Invalid subscription plan in settings loader", {
      userId,
      planId: planId || null,
      planName: planName || null,
    });
  }
  // Accounts tab is available to all plans so any user can view and manage
  // their parent/child relationship (e.g. confirm or unlink child status).
  // Server-side action guards still restrict plan-gated operations like
  // request_child and search_accounts.
  const hasAccountsAccess = true;

  const globalScheduleIntervalHours = normalizeGlobalScheduleIntervalHours(
    scheduleIntervalStrings
  );

  const effectiveWriteRelays = await getEffectiveWriteRelays(userId, {
    intent: relaySlice.relayIntent,
  });
  const relays = relaySlice.appRelays;
  const publishRelaySource = relaySlice.publishRelaySource;
  const profileRelays = relaySlice.profileRelays;
  const profileRelayEntries = relaySlice.profileRelayEntries;
  const managedRelays = effectiveWriteRelays.managed;
  const uploadProvider = uploadProviderSettings.provider;
  const uploadProviderStored = uploadProviderSettings.storedUploadProvider;
  const customBlossomUrl = uploadProviderSettings.customBlossomUrl;

  // Latest ACK per relay (best-effort). Include managed relay URL even if disabled.
  const ackRelayUrls = Array.from(
    new Set([
      ...effectiveWriteRelays.direct,
      ...relays,
      ...profileRelays,
      ...profileRelayEntries.map((e: Nip65ProfileRelayEntry) => e.url),
      ...managedRelays.map((m) => m.relayUrl),
    ])
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

  const accountsPromise: Promise<SettingsLoaderData["accounts"]> =
    buildAccountsData({
      userRecord: userRecord ?? { isChild: false, parentNpub: null },
      myNpub,
    });

  const billingBundlePromise: Promise<{
    allPlans: Awaited<ReturnType<typeof getAllPlans>>;
    paymentHistory: Awaited<ReturnType<typeof getUserPaymentHistory>>;
    referral: SettingsLoaderData["referral"];
    billingContext: BillingContext | null;
  }> = (async () => {
    if (isChild) {
      return {
        allPlans: [],
        paymentHistory: [],
        referral: EMPTY_REFERRAL,
        billingContext: null,
      };
    }

    const [allPlans, paymentHistory, referral, subscriptionSnapshot] =
      await Promise.all([
        getAllPlans(),
        getUserPaymentHistory(userId),
        getReferralSettingsData(myNpub),
        getSubscriptionData(userId),
      ]);

    return {
      allPlans,
      paymentHistory,
      referral,
      billingContext: subscriptionSnapshot.billingContext ?? null,
    };
  })();

  const [accounts, billingBundle] = await Promise.all([
    accountsPromise,
    billingBundlePromise,
  ]);

  const { allPlans, paymentHistory, referral, billingContext } = billingBundle;

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
    publishRelaySource,
    profileRelays,
    profileRelayEntries,
    managedRelays,
    relayAcks,
    giveawayBlacklist,
    queueTypes: queueTypes.map((qt) => {
      const row = qt as {
        id: string;
        name: string;
        colorToken: string | null;
        description: string | null;
        scheduleType: string;
        scheduleConfig: unknown;
        isEnabled: boolean | null;
        status: string | null;
        isDefault: boolean | null;
        userId: string;
        hashTagPresetId: string | null;
        includeHashtagsInNoteBody: boolean | null;
        hashTagPreset?: unknown;
      };

      const hpRaw = row.hashTagPreset;
      let preset: {
        id: string;
        name: string;
        tags: string;
        description?: string;
      } | null = null;
      if (
        hpRaw &&
        typeof hpRaw === "object" &&
        typeof (hpRaw as { id?: unknown }).id === "string" &&
        typeof (hpRaw as { name?: unknown }).name === "string" &&
        typeof (hpRaw as { tags?: unknown }).tags === "string"
      ) {
        const hp = hpRaw as {
          id: string;
          name: string;
          tags: string;
          description?: string | null;
        };
        preset = {
          id: hp.id,
          name: hp.name,
          tags: hp.tags,
          description: hp.description ?? undefined,
        };
      }
      return {
        id: row.id,
        name: row.name,
        color: getQueueAccentHex(row.colorToken),
        colorToken: row.colorToken ?? undefined,
        description: row.description,
        scheduleType:
          row.scheduleType === "INTERVAL" ||
          row.scheduleType === "FIXED_SLOTS" ||
          row.scheduleType === "WEEKLY_SLOTS"
            ? row.scheduleType
            : "INTERVAL",
        scheduleConfig:
          row.scheduleConfig &&
          typeof row.scheduleConfig === "object" &&
          !Array.isArray(row.scheduleConfig)
            ? row.scheduleConfig
            : undefined,
        status:
          row.status === "PAUSED"
            ? "paused"
            : row.status === "ARCHIVED"
              ? "archived"
              : "active",
        isEnabled: row.isEnabled ?? undefined,
        isDefault: row.isDefault === true,
        userId: row.userId,
        hashTagPresetId: row.hashTagPresetId ?? undefined,
        includeHashtagsInNoteBody: row.includeHashtagsInNoteBody !== false,
        hashTagPreset: preset,
      };
    }),
    globalScheduleIntervalHours,
    uploadProvider,
    uploadProviderStored,
    isSubscriptionActiveForGating: isSubscriptionActiveForGatingValue,
    customBlossomUrl,
    enableMirrorBlossom,
    mirrorUploadUrls,
    hashTagPresets: hashTagPresets,
    nwcEnabled: nwcSettings.enabled,
    maskedNwcString: nwcSettings.maskedString ?? null,
    nwcLastUsed: nwcSettings.lastUsed ?? null,
    subscription: subscription
      ? {
          id: subscription.id,
          planId: subscription.planId ?? null,
          status: subscription.status,
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
    availablePlans: allPlans
      .filter((plan) => plan.purchasable)
      .map((plan) => ({
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
    themePreference,
    canToggleBlastr,
    blastrPolicy,
    blastrSystemRelays,
    referral,
    defaultZapAmountSats,
    billingContext,
  };
}
