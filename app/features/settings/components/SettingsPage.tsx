import { Link, useLoaderData, useSearchParams } from "@remix-run/react";
import { useEffect } from "react";

import { DateFormatSettings } from "~/components/settings/DateFormatSettings";
import { NostrClientSettings } from "~/components/settings/NostrClientSettings";
import { NotificationSettings } from "~/components/settings/NotificationSettings";
import { RelaysSettings } from "~/components/settings/RelaysSettings";
import { TimeFormatSettings } from "~/components/settings/TimeFormatSettings";
import { TimezoneSettings } from "~/components/settings/TimezoneSettings";
import { RemoteSignerSettings } from "~/features/auth/components/RemoteSignerSettings";
import {
  isPrimarySignerProfile,
  type PrimarySignerProfile,
} from "~/features/auth/signer";
import {
  MutedListSettings,
  ReplyTemplatesSettings,
} from "~/features/engagement";
import { GiveawayBlacklistSettings } from "~/features/giveaway";
import { NWCSettings, SubscriptionSettings } from "~/features/payments";
import { getQueueAccentHex } from "~/features/posts/queue-colors";
import {
  type HashTagPreset,
  type QueueType,
  convertJsonValueToScheduleConfig,
} from "~/features/posts/server";
import {
  HashtagPresetsSettings,
  QueueTypesSettings,
} from "~/features/posts/ui";
import { ReferralSettings } from "~/features/referral/components/ReferralSettings";
import type {
  Nip65ProfileRelayEntry,
  Nip65RelayScope,
} from "~/features/relays/nip65-relay-entry";
import { SettingsShell } from "~/features/settings/components/SettingsShell";
import {
  getVisibleSettingsSections,
  resolveSettingsTab,
  type SettingsTabId,
} from "~/features/settings/settings-sections";
import {
  BlossomMediaMirrorsSettings,
  UploadProviderSettings,
} from "~/features/upload";
import { AccountsSettings } from "~/features/user";
import {
  validateAccounts,
  validateAvailablePlans,
  validatePaymentHistory,
  validateSubscription,
} from "~/lib/validation/settings-loader";

import { useSettingsResolvedLoaderData } from "../context/SettingsResolvedLoaderContext";

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

function parseQueueType(qt: unknown): QueueTypeSettings | null {
  if (!qt || typeof qt !== "object" || !("id" in qt) || !("name" in qt)) {
    return null;
  }
  const q = qt as {
    id: string;
    name: string;
    color?: string | null;
    scheduleType?: string;
    scheduleConfig?: unknown;
    isEnabled?: boolean;
    hashTagPresetId?: string;
    isDefault?: boolean;
    colorToken?: string | null;
    hashTagPreset?: {
      id: string;
      name: string;
      tags: string;
      description?: string;
    } | null;
  };
  return {
    id: q.id,
    name: q.name,
    color: getQueueAccentHex(
      (q as { colorToken?: string | null }).colorToken ?? null
    ),
    colorToken: (q as { colorToken?: string | null }).colorToken ?? undefined,
    description: undefined,
    scheduleType: q.scheduleType as
      | "INTERVAL"
      | "FIXED_SLOTS"
      | "WEEKLY_SLOTS"
      | undefined,
    scheduleConfig: convertJsonValueToScheduleConfig(q.scheduleConfig),
    isEnabled: q.isEnabled,
    isDefault: q.isDefault ?? false,
    hashTagPresetId: q.hashTagPresetId,
    hashTagPreset: q.hashTagPreset,
  };
}

function parseQueueTypes(queueTypesRaw: unknown): QueueTypeSettings[] {
  if (!Array.isArray(queueTypesRaw)) {
    return [];
  }
  return queueTypesRaw
    .map((qt) => parseQueueType(qt))
    .filter((qt): qt is QueueTypeSettings => qt !== null);
}

function isValidHashTagPreset(preset: unknown): preset is {
  id: string;
  name: string;
  tags: string;
  description?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  userId?: unknown;
} {
  return (
    typeof preset === "object" &&
    preset !== null &&
    "id" in preset &&
    "name" in preset &&
    "tags" in preset &&
    typeof (preset as { id: unknown; name: unknown; tags: unknown }).id ===
      "string" &&
    typeof (preset as { id: unknown; name: unknown; tags: unknown }).name ===
      "string" &&
    typeof (preset as { id: unknown; name: unknown; tags: unknown }).tags ===
      "string"
  );
}

function parseDateValue(dateValue: unknown): Date | undefined {
  if (dateValue === null || dateValue === undefined) {
    return undefined;
  }
  if (dateValue instanceof Date) {
    return dateValue;
  }
  if (typeof dateValue === "string") {
    return new Date(dateValue);
  }
  return undefined;
}

function parseHashTagPreset(preset: {
  id: string;
  name: string;
  tags: string;
  description?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  userId?: unknown;
}): HashTagPreset {
  return {
    id: preset.id,
    name: preset.name,
    tags: preset.tags,
    description:
      preset.description === null
        ? null
        : typeof preset.description === "string"
          ? preset.description
          : undefined,
    userId: typeof preset.userId === "string" ? preset.userId : undefined,
    createdAt: parseDateValue(preset.createdAt),
    updatedAt: parseDateValue(preset.updatedAt),
  };
}

function parseHashTagPresets(hashTagPresetsRaw: unknown): HashTagPreset[] {
  if (!Array.isArray(hashTagPresetsRaw)) {
    return [];
  }
  return hashTagPresetsRaw
    .filter((p) => isValidHashTagPreset(p))
    .map((p) => parseHashTagPreset(p));
}

function parseMutedList(mutedListRaw: unknown): {
  npubs: string[];
  lastSynced: string;
} {
  const mutedListRawTyped = mutedListRaw as
    | { npubs?: unknown; lastSynced?: unknown }
    | null
    | undefined;
  if (
    mutedListRawTyped &&
    typeof mutedListRawTyped === "object" &&
    !Array.isArray(mutedListRawTyped)
  ) {
    return {
      npubs: Array.isArray(mutedListRawTyped.npubs)
        ? (mutedListRawTyped.npubs as string[])
        : [],
      lastSynced:
        typeof mutedListRawTyped.lastSynced === "string"
          ? mutedListRawTyped.lastSynced
          : new Date().toISOString(),
    };
  }
  return { npubs: [], lastSynced: new Date().toISOString() };
}

interface ManagedRelay {
  id: string;
  role: string;
  enabled: boolean;
  relayUrl: string;
}

interface RelayAck {
  status: string;
  createdAt: string;
  receivedAt: string | null;
}

function parsePrimarySignerProfile(
  value: unknown
): PrimarySignerProfile | null {
  return isPrimarySignerProfile(value) ? value : null;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asStringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function asPublishRelaySource(value: unknown): "app" | "nip65_profile" {
  return value === "nip65_profile" ? "nip65_profile" : "app";
}

function toIsoStringOrNow(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

function toIsoStringOrNull(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
}

function parseProfileRelayEntries(value: unknown): Nip65ProfileRelayEntry[] {
  if (!Array.isArray(value)) return [];
  const scopes = new Set<Nip65RelayScope>(["both", "read", "write"]);
  return value
    .map((e) => {
      if (!e || typeof e !== "object" || Array.isArray(e)) return null;
      const obj = e as Record<string, unknown>;
      const url = typeof obj["url"] === "string" ? obj["url"] : null;
      const scope = typeof obj["scope"] === "string" ? obj["scope"] : null;
      if (!url || !scope || !scopes.has(scope as Nip65RelayScope)) return null;
      return { url, scope: scope as Nip65RelayScope };
    })
    .filter((v): v is Nip65ProfileRelayEntry => v !== null);
}

function parseManagedRelays(value: unknown): ManagedRelay[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => {
      if (!v || typeof v !== "object" || Array.isArray(v)) return null;
      const obj = v as Record<string, unknown>;
      const id = typeof obj["id"] === "string" ? obj["id"] : null;
      const role = typeof obj["role"] === "string" ? obj["role"] : null;
      const enabled =
        typeof obj["enabled"] === "boolean" ? obj["enabled"] : null;
      const relayUrl =
        typeof obj["relayUrl"] === "string" ? obj["relayUrl"] : null;
      if (!id || !role || enabled === null || !relayUrl) return null;
      return { id, role, enabled, relayUrl } satisfies ManagedRelay;
    })
    .filter((v): v is ManagedRelay => v !== null);
}

function parseRelayAcksMap(value: unknown): Record<string, RelayAck> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, RelayAck>;
}

function renderSettingsPanel(
  tab: SettingsTabId,
  ctx: {
    isChildBool: boolean;
    hasAccountsAccessBool: boolean;
    timezoneValue: string | null;
    timeFormatRaw: unknown;
    dateFormatRaw: unknown;
    preferredNostrClientRaw: unknown;
    customNostrClientBaseUrlRaw: unknown;
    pushNotificationsEnabled: unknown;
    pushNotifyPublishSuccess: unknown;
    pushNotifyPublishFailure: unknown;
    pushNotifyRunwayLow: unknown;
    pushNotifyIncludePreview: unknown;
    runwayNotifyBelowDays: unknown;
    primarySignerProfile: PrimarySignerProfile | null;
    queueTypes: QueueTypeSettings[];
    hashTagPresets: HashTagPreset[];
    accounts: ReturnType<typeof validateAccounts>;
    relaysList: string[];
    publishRelaySourceValue: "app" | "nip65_profile";
    profileRelayEntriesList: Nip65ProfileRelayEntry[];
    managedRelaysList: ManagedRelay[];
    relayAcksMap: Record<string, RelayAck>;
    blastrRelayEnabled: unknown;
    canToggleBlastr: unknown;
    blastrPolicyRaw: unknown;
    blastrSystemRelaysRaw: unknown;
    giveawayBlacklistList: string[];
    mutedList: ReturnType<typeof parseMutedList>;
    filterMutedValue: boolean;
    hidePostsFromLowTrustUsersValue: boolean;
    replyTemplates: Array<{ id: string; slug: string; body: string }>;
    uploadProviderValue: string;
    customBlossomUrlValue: string | null;
    enableMirrorBlossomValue: boolean;
    mirrorUploadUrlsList: string[];
    subscription: ReturnType<typeof validateSubscription>;
    availablePlans: ReturnType<typeof validateAvailablePlans>;
    paymentHistory: ReturnType<typeof validatePaymentHistory>;
    nwcEnabledValue: boolean;
    maskedNwcStringValue: string | undefined;
    nwcLastUsedValue: string | null;
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
) {
  const {
    isChildBool,
    hasAccountsAccessBool,
    timezoneValue,
    timeFormatRaw,
    dateFormatRaw,
    preferredNostrClientRaw,
    customNostrClientBaseUrlRaw,
    pushNotificationsEnabled,
    pushNotifyPublishSuccess,
    pushNotifyPublishFailure,
    pushNotifyRunwayLow,
    pushNotifyIncludePreview,
    runwayNotifyBelowDays,
    primarySignerProfile,
    queueTypes,
    hashTagPresets,
    accounts,
    relaysList,
    publishRelaySourceValue,
    profileRelayEntriesList,
    managedRelaysList,
    relayAcksMap,
    blastrRelayEnabled,
    canToggleBlastr,
    blastrPolicyRaw,
    blastrSystemRelaysRaw,
    giveawayBlacklistList,
    mutedList,
    filterMutedValue,
    hidePostsFromLowTrustUsersValue,
    replyTemplates,
    uploadProviderValue,
    customBlossomUrlValue,
    enableMirrorBlossomValue,
    mirrorUploadUrlsList,
    subscription,
    availablePlans,
    paymentHistory,
    nwcEnabledValue,
    maskedNwcStringValue,
    nwcLastUsedValue,
    referral,
  } = ctx;

  switch (tab) {
    case "general":
      return (
        <div className="grid min-w-0 gap-6 md:grid-cols-1">
          <TimezoneSettings timezone={timezoneValue} />
          <TimeFormatSettings
            timeFormat={timeFormatRaw === "24h" ? "24h" : "12h"}
          />
          <DateFormatSettings
            dateFormat={
              dateFormatRaw === "mmddyyyy" || dateFormatRaw === "yyyymmdd"
                ? dateFormatRaw
                : "ddmmyyyy"
            }
          />
          <NostrClientSettings
            preferredNostrClient={
              typeof preferredNostrClientRaw === "string"
                ? preferredNostrClientRaw
                : "PRIMAL"
            }
            customNostrClientBaseUrl={asStringOrNull(
              customNostrClientBaseUrlRaw
            )}
          />
          <NotificationSettings
            pushNotificationsEnabled={asBoolean(pushNotificationsEnabled, true)}
            pushNotifyPublishSuccess={asBoolean(pushNotifyPublishSuccess, true)}
            pushNotifyPublishFailure={asBoolean(pushNotifyPublishFailure, true)}
            pushNotifyRunwayLow={asBoolean(pushNotifyRunwayLow, false)}
            pushNotifyIncludePreview={asBoolean(pushNotifyIncludePreview, true)}
            runwayNotifyBelowDays={
              typeof runwayNotifyBelowDays === "number" &&
              Number.isInteger(runwayNotifyBelowDays) &&
              runwayNotifyBelowDays >= 0
                ? runwayNotifyBelowDays
                : null
            }
          />
          <RemoteSignerSettings primarySignerProfile={primarySignerProfile} />
        </div>
      );
    case "content":
      return (
        <div className="grid min-w-0 gap-6 md:grid-cols-1">
          <QueueTypesSettings
            queueTypes={queueTypes}
            hashTagPresets={hashTagPresets.map((p) => ({
              id: p.id,
              name: p.name,
              tags: p.tags,
              description: p.description ?? undefined,
            }))}
          />
          <HashtagPresetsSettings
            presets={hashTagPresets.map((p) => ({
              id: p.id,
              name: p.name,
              tags: p.tags,
              description: p.description ?? null,
              createdAt: toIsoStringOrNow(p.createdAt),
              updatedAt: toIsoStringOrNow(p.updatedAt),
            }))}
          />
        </div>
      );
    case "network":
      return (
        <div className="grid min-w-0 gap-6 md:grid-cols-1">
          <RelaysSettings
            relays={relaysList}
            publishRelaySource={publishRelaySourceValue}
            profileRelayEntries={profileRelayEntriesList}
            managedRelays={managedRelaysList}
            relayAcks={relayAcksMap}
            blastrRelayEnabled={asBoolean(blastrRelayEnabled, true)}
            canToggleBlastr={asBoolean(canToggleBlastr, false)}
            canShowBlastrPolicyModal={
              asBoolean(canToggleBlastr, false) && blastrPolicyRaw != null
                ? Array.isArray(blastrSystemRelaysRaw)
                : undefined
            }
            blastrPolicy={
              typeof blastrPolicyRaw === "object" &&
              blastrPolicyRaw != null &&
              "policy" in blastrPolicyRaw &&
              (blastrPolicyRaw as { policy: unknown }).policy != null
                ? (
                    blastrPolicyRaw as {
                      policy: {
                        mode: "blacklist" | "whitelist";
                        enabled: boolean;
                      } | null;
                    }
                  ).policy
                : null
            }
            blastrPolicyRelays={
              typeof blastrPolicyRaw === "object" &&
              blastrPolicyRaw != null &&
              "relays" in blastrPolicyRaw &&
              Array.isArray((blastrPolicyRaw as { relays: unknown }).relays)
                ? (
                    blastrPolicyRaw as {
                      relays: Array<{
                        relay_url: string;
                        action: "allow" | "block";
                      }>;
                    }
                  ).relays
                : []
            }
            blastrSystemRelays={
              Array.isArray(blastrSystemRelaysRaw)
                ? (blastrSystemRelaysRaw as string[])
                : []
            }
          />
          <GiveawayBlacklistSettings
            giveawayBlacklist={giveawayBlacklistList}
          />
          <MutedListSettings
            mutedList={mutedList}
            filterMuted={filterMutedValue}
            hidePostsFromLowTrustUsers={hidePostsFromLowTrustUsersValue}
          />
          <ReplyTemplatesSettings templates={replyTemplates} />
        </div>
      );
    case "storage":
      return (
        <div className="grid min-w-0 gap-6 md:grid-cols-1">
          <UploadProviderSettings
            uploadProvider={uploadProviderValue}
            customBlossomUrl={customBlossomUrlValue}
          />
          <BlossomMediaMirrorsSettings
            enableMirrorBlossom={enableMirrorBlossomValue}
            mirrorUploadUrls={mirrorUploadUrlsList}
          />
          <div className="text-sm">
            <Link
              to="/dashboard/settings/media"
              className="text-primary hover:underline"
            >
              Manage Blossom media (list, usage, delete records)
            </Link>
          </div>
        </div>
      );
    case "subscription":
      if (isChildBool) return null;
      return (
        <div className="grid min-w-0 gap-6 md:grid-cols-1">
          <SubscriptionSettings
            subscription={subscription}
            availablePlans={availablePlans}
            paymentHistory={paymentHistory}
            nwcEnabled={nwcEnabledValue}
          />
          <NWCSettings
            nwcEnabled={nwcEnabledValue}
            maskedNwcString={maskedNwcStringValue}
            nwcLastUsed={nwcLastUsedValue}
          />
        </div>
      );
    case "referral":
      if (isChildBool) return null;
      return (
        <div className="grid min-w-0 gap-6 md:grid-cols-1">
          <ReferralSettings
            referralLink={referral.referralLink}
            commissionRatePercent={referral.commissionRatePercent}
            totalEarnedSats={referral.totalEarnedSats}
            paidSats={referral.paidSats}
            pendingSats={referral.pendingSats}
            failedSats={referral.failedSats}
            payoutDestination={referral.payoutDestination}
            payoutDestinationType={referral.payoutDestinationType}
          />
        </div>
      );
    case "accounts":
      if (!hasAccountsAccessBool) return null;
      return (
        <div className="grid min-w-0 gap-6 md:grid-cols-1">
          {accounts ? (
            <AccountsSettings
              parentNpub={accounts.parentNpub}
              confirmedChildren={accounts.confirmedChildren}
              pendingChildren={accounts.pendingChildren}
              isChild={accounts.isChild ?? false}
              parentUser={accounts.parentUser}
            />
          ) : (
            <div className="text-muted-foreground text-sm">
              Your account npub is not available.
            </div>
          )}
        </div>
      );
    default:
      return null;
  }
}

export default function SettingsPage() {
  const resolvedFromDefer = useSettingsResolvedLoaderData();
  const loaderDataFromRoute = useLoaderData<unknown>();
  const loaderDataRaw = resolvedFromDefer ?? loaderDataFromRoute;
  const [searchParams, setSearchParams] = useSearchParams();
  const data = loaderDataRaw as {
    timezone?: unknown;
    relays?: unknown;
    publishRelaySource?: unknown;
    profileRelays?: unknown;
    profileRelayEntries?: unknown;
    managedRelays?: unknown;
    relayAcks?: unknown;
    giveawayBlacklist?: unknown;
    queueTypes?: unknown;
    uploadProvider?: unknown;
    customBlossomUrl?: unknown;
    enableMirrorBlossom?: unknown;
    mirrorUploadUrls?: unknown;
    hashTagPresets?: unknown;
    nwcEnabled?: unknown;
    maskedNwcString?: unknown;
    nwcLastUsed?: unknown;
    subscription?: unknown;
    availablePlans?: unknown;
    paymentHistory?: unknown;
    isChild?: unknown;
    hasAccountsAccess?: unknown;
    accounts?: unknown;
    mutedList?: unknown;
    replyTemplates?: unknown;
    filterMuted?: unknown;
    hidePostsFromLowTrustUsers?: unknown;
    pushNotificationsEnabled?: unknown;
    pushNotifyPublishSuccess?: unknown;
    pushNotifyPublishFailure?: unknown;
    pushNotifyRunwayLow?: unknown;
    pushNotifyIncludePreview?: unknown;
    runwayNotifyBelowDays?: unknown;
    timeFormat?: unknown;
    dateFormat?: unknown;
    preferredNostrClient?: unknown;
    customNostrClientBaseUrl?: unknown;
    primarySignerProfile?: unknown;
    blastrRelayEnabled?: unknown;
    canToggleBlastr?: unknown;
    blastrPolicy?: unknown;
    blastrSystemRelays?: unknown;
    referral?: {
      referralLink: string;
      commissionRatePercent: number;
      totalEarnedSats: number;
      paidSats: number;
      pendingSats: number;
      failedSats: number;
      payoutDestination: string | null;
      payoutDestinationType: string | null;
    };
  };

  const {
    timezone,
    relays,
    publishRelaySource,
    profileRelayEntries,
    managedRelays,
    relayAcks,
    giveawayBlacklist,
    queueTypes: queueTypesRaw,
    uploadProvider,
    customBlossomUrl,
    enableMirrorBlossom,
    mirrorUploadUrls,
    hashTagPresets: hashTagPresetsRaw,
    nwcEnabled,
    maskedNwcString,
    nwcLastUsed,
    subscription: subscriptionRaw,
    availablePlans: availablePlansRaw,
    paymentHistory: paymentHistoryRaw,
    isChild,
    hasAccountsAccess,
    accounts: accountsRaw,
    mutedList: mutedListRaw,
    replyTemplates: replyTemplatesRaw,
    filterMuted,
    hidePostsFromLowTrustUsers,
    pushNotificationsEnabled,
    pushNotifyPublishSuccess,
    pushNotifyPublishFailure,
    pushNotifyRunwayLow,
    pushNotifyIncludePreview,
    runwayNotifyBelowDays,
    timeFormat: timeFormatRaw,
    dateFormat: dateFormatRaw,
    preferredNostrClient: preferredNostrClientRaw,
    customNostrClientBaseUrl: customNostrClientBaseUrlRaw,
    primarySignerProfile: primarySignerProfileRaw,
    blastrRelayEnabled,
    canToggleBlastr,
    blastrPolicy: blastrPolicyRaw,
    blastrSystemRelays: blastrSystemRelaysRaw,
    referral: referralRaw,
  } = data;

  function parseReplyTemplates(
    value: unknown
  ): Array<{ id: string; slug: string; body: string }> {
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (t): t is Record<string, unknown> =>
          t != null &&
          typeof t === "object" &&
          typeof (t as { id?: unknown }).id === "string" &&
          typeof (t as { slug?: unknown }).slug === "string" &&
          typeof (t as { body?: unknown }).body === "string"
      )
      .map((t) => ({
        id: (t as { id: string }).id,
        slug: (t as { slug: string }).slug,
        body: (t as { body: string }).body,
      }));
  }

  const replyTemplates = parseReplyTemplates(replyTemplatesRaw);

  const queueTypes = parseQueueTypes(queueTypesRaw);
  const accounts = validateAccounts(accountsRaw);
  const hashTagPresets = parseHashTagPresets(hashTagPresetsRaw);
  const subscription = validateSubscription(subscriptionRaw);
  const availablePlans = validateAvailablePlans(availablePlansRaw);
  const paymentHistory = validatePaymentHistory(paymentHistoryRaw);
  const mutedList = parseMutedList(mutedListRaw);

  const isChildBool = asBoolean(isChild);
  const hasAccountsAccessBool = asBoolean(hasAccountsAccess);
  const activeTab = resolveSettingsTab({
    tabParam: searchParams.get("tab"),
    isChild: isChildBool,
    hasAccountsAccess: hasAccountsAccessBool,
  });
  const settingsSections = getVisibleSettingsSections({
    isChild: isChildBool,
    hasAccountsAccess: hasAccountsAccessBool,
  });

  useEffect(() => {
    const requested = searchParams.get("tab");
    if (!requested || requested === activeTab) return;
    const next = new URLSearchParams(searchParams);
    next.set("tab", activeTab);
    setSearchParams(next, { replace: true, preventScrollReset: true });
  }, [activeTab, searchParams, setSearchParams]);

  const referral =
    referralRaw &&
    typeof referralRaw === "object" &&
    "referralLink" in referralRaw
      ? (referralRaw as {
          referralLink: string;
          commissionRatePercent: number;
          totalEarnedSats: number;
          paidSats: number;
          pendingSats: number;
          failedSats: number;
          payoutDestination: string | null;
          payoutDestinationType: string | null;
        })
      : {
          referralLink: "",
          commissionRatePercent: 20,
          totalEarnedSats: 0,
          paidSats: 0,
          pendingSats: 0,
          failedSats: 0,
          payoutDestination: null as string | null,
          payoutDestinationType: null as string | null,
        };

  const timezoneValue = asStringOrNull(timezone);
  const relaysList = asStringArray(relays);
  const publishRelaySourceValue = asPublishRelaySource(publishRelaySource);
  const profileRelayEntriesList = parseProfileRelayEntries(profileRelayEntries);
  const managedRelaysList = parseManagedRelays(managedRelays);
  const relayAcksMap = parseRelayAcksMap(relayAcks);
  const giveawayBlacklistList = asStringArray(giveawayBlacklist);
  const uploadProviderValue = asStringOrUndefined(uploadProvider) ?? "";
  const customBlossomUrlValue = asStringOrNull(customBlossomUrl);
  const enableMirrorBlossomValue = asBoolean(enableMirrorBlossom);
  const mirrorUploadUrlsList = asStringArray(mirrorUploadUrls);
  const nwcEnabledValue = asBoolean(nwcEnabled);
  const maskedNwcStringValue = asStringOrUndefined(maskedNwcString);
  const nwcLastUsedValue = toIsoStringOrNull(nwcLastUsed);
  const filterMutedValue = asBoolean(filterMuted);
  const hidePostsFromLowTrustUsersValue = asBoolean(hidePostsFromLowTrustUsers);
  const primarySignerProfile = parsePrimarySignerProfile(
    primarySignerProfileRaw
  );

  return (
    <SettingsShell sections={settingsSections} activeTab={activeTab}>
      {renderSettingsPanel(activeTab, {
        isChildBool,
        hasAccountsAccessBool,
        timezoneValue,
        timeFormatRaw,
        dateFormatRaw,
        preferredNostrClientRaw,
        customNostrClientBaseUrlRaw,
        pushNotificationsEnabled,
        pushNotifyPublishSuccess,
        pushNotifyPublishFailure,
        pushNotifyRunwayLow,
        pushNotifyIncludePreview,
        runwayNotifyBelowDays,
        primarySignerProfile,
        queueTypes,
        hashTagPresets,
        accounts,
        relaysList,
        publishRelaySourceValue,
        profileRelayEntriesList,
        managedRelaysList,
        relayAcksMap,
        blastrRelayEnabled,
        canToggleBlastr,
        blastrPolicyRaw,
        blastrSystemRelaysRaw,
        giveawayBlacklistList,
        mutedList,
        filterMutedValue,
        hidePostsFromLowTrustUsersValue,
        replyTemplates,
        uploadProviderValue,
        customBlossomUrlValue,
        enableMirrorBlossomValue,
        mirrorUploadUrlsList,
        subscription,
        availablePlans,
        paymentHistory,
        nwcEnabledValue,
        maskedNwcStringValue,
        nwcLastUsedValue,
        referral,
      })}
    </SettingsShell>
  );
}
