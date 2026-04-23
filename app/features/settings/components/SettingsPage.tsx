import {
  Link,
  useLoaderData,
  useNavigation,
  useSearchParams,
} from "@remix-run/react";
import { useEffect } from "react";

import { NostrClientSettings } from "~/components/settings/NostrClientSettings";
import { NotificationSettings } from "~/components/settings/NotificationSettings";
import { RegionalDisplaySettings } from "~/components/settings/RegionalDisplaySettings";
import { RelaysSettings } from "~/components/settings/RelaysSettings";
import { ThemePreferenceSettings } from "~/components/settings/ThemePreferenceSettings";
import { RemoteSignerSettings } from "~/features/auth/components/RemoteSignerSettings";
import type { PrimarySignerProfile } from "~/features/auth/signer";
import {
  MutedListSettings,
  ReplyTemplatesSettings,
} from "~/features/engagement";
import { GiveawayBlacklistSettings } from "~/features/giveaway";
import type { BillingContext } from "~/features/payments/types/subscription-billing.types";
import type { HashTagPreset } from "~/features/posts/server";
import {
  HashtagPresetsSettings,
  QueueTypesSettings,
} from "~/features/posts/ui";
import type { Nip65ProfileRelayEntry } from "~/features/relays/nip65-relay-entry";
import { BillingSettings } from "~/features/settings/components/BillingSettings";
import { DefaultZapAmountSettings } from "~/features/settings/components/DefaultZapAmountSettings";
import { PreferenceSection } from "~/features/settings/components/patterns";
import { SettingsShell } from "~/features/settings/components/SettingsShell";
import {
  billingSegmentForNormalizedTab,
  getVisibleSettingsSections,
  resolveSettingsTab,
  type SettingsTabId,
} from "~/features/settings/settings-sections";
import {
  BlossomMediaMirrorsSettings,
  UploadProviderSettings,
} from "~/features/upload";
import { AccountsSettings } from "~/features/user";
import { BRAND_BLOSSOM_LABEL } from "~/lib/brand";
import {
  validateAccounts,
  validateAvailablePlans,
  validatePaymentHistory,
  validateSubscription,
} from "~/lib/validation/settings-loader";

import { useSettingsResolvedLoaderData } from "../context/SettingsResolvedLoaderContext";

import {
  asBoolean,
  asPublishRelaySource,
  asStringArray,
  asStringOrNull,
  asStringOrUndefined,
  parseHashTagPresets,
  parseManagedRelays,
  parseMutedList,
  parsePrimarySignerProfile,
  parseProfileRelayEntries,
  parseGlobalScheduleIntervalHours,
  parseQueueTypes,
  parseRelayAcksMap,
  toIsoStringOrNull,
  toIsoStringOrNow,
  type ManagedRelay,
  type QueueTypeSettings,
  type RelayAck,
} from "./settings-page-loader-parsers";
import { SettingsActivePanelSkeleton } from "./SettingsActivePanelSkeleton";

function renderSettingsPanel(
  tab: SettingsTabId,
  ctx: {
    isChildBool: boolean;
    timezoneValue: string | null;
    timeFormatRaw: unknown;
    dateFormatRaw: unknown;
    preferredNostrClientRaw: unknown;
    customNostrClientBaseUrlRaw: unknown;
    themePreferenceRaw: unknown;
    pushNotificationsEnabled: unknown;
    pushNotifyPublishSuccess: unknown;
    pushNotifyPublishFailure: unknown;
    pushNotifyRunwayLow: unknown;
    pushNotifyIncludePreview: unknown;
    runwayNotifyBelowDays: unknown;
    primarySignerProfile: PrimarySignerProfile | null;
    queueTypes: QueueTypeSettings[];
    globalScheduleIntervalHours: number[];
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
    uploadProviderStoredValue: string;
    isSubscriptionActiveForGatingValue: boolean;
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
    defaultZapAmountSats: number | null;
    billingContext: BillingContext | null;
  }
) {
  const {
    isChildBool,
    timezoneValue,
    timeFormatRaw,
    dateFormatRaw,
    preferredNostrClientRaw,
    customNostrClientBaseUrlRaw,
    themePreferenceRaw,
    pushNotificationsEnabled,
    pushNotifyPublishSuccess,
    pushNotifyPublishFailure,
    pushNotifyRunwayLow,
    pushNotifyIncludePreview,
    runwayNotifyBelowDays,
    primarySignerProfile,
    queueTypes,
    globalScheduleIntervalHours,
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
    uploadProviderStoredValue,
    isSubscriptionActiveForGatingValue,
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
    defaultZapAmountSats,
    billingContext,
  } = ctx;

  const relaysPanel = (
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
      hasActiveSubscription={subscription?.status === "ACTIVE"}
    />
  );

  switch (tab) {
    case "general":
      return (
        <div className="flex min-w-0 flex-col gap-6">
          <RegionalDisplaySettings
            timezone={timezoneValue}
            timeFormat={timeFormatRaw === "24h" ? "24h" : "12h"}
            dateFormat={
              dateFormatRaw === "mmddyyyy" || dateFormatRaw === "yyyymmdd"
                ? dateFormatRaw
                : "ddmmyyyy"
            }
          />
          <ThemePreferenceSettings
            themePreference={
              themePreferenceRaw === "system" ||
              themePreferenceRaw === "light" ||
              themePreferenceRaw === "dark"
                ? themePreferenceRaw
                : null
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
        </div>
      );
    case "publishing":
      return (
        <div className="flex min-w-0 flex-col gap-6">
          <QueueTypesSettings
            queueTypes={queueTypes}
            globalScheduleIntervalHours={globalScheduleIntervalHours}
            hashTagPresets={hashTagPresets.map((p) => ({
              id: p.id,
              name: p.name,
              tags: p.tags,
              description: p.description ?? undefined,
            }))}
          />
          <HashtagPresetsSettings
            queueTypes={queueTypes}
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
    case "engagement":
      return (
        <div className="flex min-w-0 flex-col gap-8">
          <div className="stack">
            <p className="text-text-secondary text-xs font-medium tracking-wide uppercase">
              Engagement defaults
            </p>
            <div className="stack sm:gap-6">
              <DefaultZapAmountSettings
                defaultZapAmountSats={defaultZapAmountSats}
              />
              <ReplyTemplatesSettings templates={replyTemplates} />
            </div>
          </div>
          <MutedListSettings
            mutedList={mutedList}
            filterMuted={filterMutedValue}
            hidePostsFromLowTrustUsers={hidePostsFromLowTrustUsersValue}
          />
          <div className="stack">
            <p className="text-text-secondary text-xs font-medium tracking-wide uppercase">
              Participation safety
            </p>
            <GiveawayBlacklistSettings
              giveawayBlacklist={giveawayBlacklistList}
            />
          </div>
        </div>
      );
    case "relays":
      return <div className="flex min-w-0 flex-col gap-6">{relaysPanel}</div>;
    case "media":
      return (
        <div className="flex min-w-0 flex-col gap-6">
          <UploadProviderSettings
            key={`${uploadProviderValue}-${customBlossomUrlValue ?? ""}`}
            uploadProvider={uploadProviderValue}
            uploadProviderStored={uploadProviderStoredValue}
            customBlossomUrl={customBlossomUrlValue}
            isSubscriptionActiveForGating={isSubscriptionActiveForGatingValue}
          />
          <BlossomMediaMirrorsSettings
            enableMirrorBlossom={enableMirrorBlossomValue}
            mirrorUploadUrls={mirrorUploadUrlsList}
          />
          <PreferenceSection
            title="Blossom media library"
            description={`Browse ${BRAND_BLOSSOM_LABEL} uploads and storage usage. Media from other upload providers does not appear here. Deleting removes the library entry and the file on ${BRAND_BLOSSOM_LABEL} when the server confirms removal; if deletion fails, the item stays.`}
          >
            <p className="text-sm">
              <Link
                to="/dashboard/settings/media"
                className="text-brand font-medium hover:underline"
              >
                Open media library
              </Link>
            </p>
          </PreferenceSection>
        </div>
      );
    case "signers":
      return (
        <div className="flex min-w-0 flex-col gap-6">
          <RemoteSignerSettings primarySignerProfile={primarySignerProfile} />
        </div>
      );
    case "billing":
      if (isChildBool) return null;
      return (
        <BillingSettings
          subscription={subscription}
          availablePlans={availablePlans}
          paymentHistory={paymentHistory}
          nwcEnabled={nwcEnabledValue}
          maskedNwcString={maskedNwcStringValue}
          nwcLastUsed={nwcLastUsedValue}
          referral={referral}
          billingContext={billingContext}
        />
      );
    case "accounts":
      return (
        <div className="flex min-w-0 flex-col gap-6">
          {accounts ? (
            <AccountsSettings
              parentNpub={accounts.parentNpub}
              confirmedChildren={accounts.confirmedChildren}
              pendingChildren={accounts.pendingChildren}
              isChild={accounts.isChild ?? false}
              parentUser={accounts.parentUser}
            />
          ) : (
            <div className="text-text-secondary text-sm">
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
  const navigation = useNavigation();
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
    globalScheduleIntervalHours?: unknown;
    uploadProvider?: unknown;
    uploadProviderStored?: unknown;
    isSubscriptionActiveForGating?: unknown;
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
    themePreference?: unknown;
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
    defaultZapAmountSats?: unknown;
    billingContext?: unknown;
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
    globalScheduleIntervalHours: globalScheduleIntervalHoursRaw,
    uploadProvider,
    uploadProviderStored,
    isSubscriptionActiveForGating: isSubscriptionActiveForGatingRaw,
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
    themePreference: themePreferenceRaw,
    primarySignerProfile: primarySignerProfileRaw,
    blastrRelayEnabled,
    canToggleBlastr,
    blastrPolicy: blastrPolicyRaw,
    blastrSystemRelays: blastrSystemRelaysRaw,
    referral: referralRaw,
    defaultZapAmountSats: defaultZapAmountSatsRaw,
    billingContext: billingContextRaw,
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
  const globalScheduleIntervalHours = parseGlobalScheduleIntervalHours(
    globalScheduleIntervalHoursRaw
  );
  const accounts = validateAccounts(accountsRaw);
  const hashTagPresets = parseHashTagPresets(hashTagPresetsRaw);
  const subscription = validateSubscription(subscriptionRaw);
  const availablePlans = validateAvailablePlans(availablePlansRaw);
  const paymentHistory = validatePaymentHistory(paymentHistoryRaw);
  const mutedList = parseMutedList(mutedListRaw);
  const billingContext =
    (billingContextRaw as BillingContext | null | undefined) ?? null;

  const isChildBool = asBoolean(isChild);
  const activeTab = resolveSettingsTab({
    tabParam: searchParams.get("tab"),
    isChild: isChildBool,
  });
  const settingsSections = getVisibleSettingsSections({
    isChild: isChildBool,
  });

  const isLoadingNextTab =
    navigation.state === "loading" &&
    navigation.location.pathname === "/dashboard/settings";

  const nextSearch = navigation.location ? navigation.location.search : "";
  const nextTabParam = isLoadingNextTab
    ? new URLSearchParams(nextSearch).get("tab")
    : null;

  const nextActiveTab = nextTabParam
    ? resolveSettingsTab({
        tabParam: nextTabParam,
        isChild: isChildBool,
      })
    : activeTab;

  useEffect(() => {
    const requested = searchParams.get("tab");
    const next = new URLSearchParams(searchParams);
    let changed = false;

    if (requested && requested !== activeTab) {
      next.set("tab", activeTab);
      changed = true;
    }

    if (
      activeTab === "billing" &&
      billingSegmentForNormalizedTab(requested, activeTab) === "referral" &&
      next.get("billing") !== "referral"
    ) {
      next.set("billing", "referral");
      changed = true;
    }

    if (changed) {
      setSearchParams(next, { replace: true, preventScrollReset: true });
    }
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
  const uploadProviderStoredValue =
    asStringOrUndefined(uploadProviderStored) ?? uploadProviderValue;
  const isSubscriptionActiveForGatingValue = asBoolean(
    isSubscriptionActiveForGatingRaw,
    false
  );
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

  const defaultZapAmountSats =
    typeof defaultZapAmountSatsRaw === "number" &&
    Number.isInteger(defaultZapAmountSatsRaw) &&
    defaultZapAmountSatsRaw >= 1
      ? defaultZapAmountSatsRaw
      : null;

  return (
    <SettingsShell sections={settingsSections} activeTab={nextActiveTab}>
      {isLoadingNextTab ? (
        <SettingsActivePanelSkeleton />
      ) : (
        renderSettingsPanel(activeTab, {
          isChildBool,
          timezoneValue,
          timeFormatRaw,
          dateFormatRaw,
          preferredNostrClientRaw,
          customNostrClientBaseUrlRaw,
          themePreferenceRaw,
          pushNotificationsEnabled,
          pushNotifyPublishSuccess,
          pushNotifyPublishFailure,
          pushNotifyRunwayLow,
          pushNotifyIncludePreview,
          runwayNotifyBelowDays,
          primarySignerProfile,
          queueTypes,
          globalScheduleIntervalHours,
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
          uploadProviderStoredValue,
          isSubscriptionActiveForGatingValue,
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
          defaultZapAmountSats,
          billingContext,
        })
      )}
    </SettingsShell>
  );
}
