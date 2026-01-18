import { useLoaderData } from "@remix-run/react";

import { RelaysSettings } from "~/components/settings/RelaysSettings";
import { TimezoneSettings } from "~/components/settings/TimezoneSettings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { MutedListSettings } from "~/features/engagement";
import { GiveawayBlacklistSettings } from "~/features/giveaway";
import { NWCSettings, SubscriptionSettings } from "~/features/payments";
import {
  type HashTagPreset,
  type QueueType,
  convertJsonValueToScheduleConfig,
} from "~/features/posts/server";
import {
  HashtagPresetsSettings,
  QueueTypesSettings,
  ScheduleIntervalsSettings,
} from "~/features/posts/ui";
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
    color: q.color,
    description: undefined,
    scheduleType: q.scheduleType as "INTERVAL" | "FIXED_SLOTS" | undefined,
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

export default function SettingsPage() {
  const loaderDataRaw = useLoaderData<unknown>();
  const data = loaderDataRaw as {
    timezone?: unknown;
    relays?: unknown;
    giveawayBlacklist?: unknown;
    scheduleIntervals?: unknown;
    queueTypes?: unknown;
    uploadProvider?: unknown;
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
    filterMuted?: unknown;
    hidePostsFromLowTrustUsers?: unknown;
  };

  const {
    timezone,
    relays,
    giveawayBlacklist,
    scheduleIntervals,
    queueTypes: queueTypesRaw,
    uploadProvider,
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
    filterMuted,
    hidePostsFromLowTrustUsers,
  } = data;

  const queueTypes = parseQueueTypes(queueTypesRaw);
  const accounts = validateAccounts(accountsRaw);
  const hashTagPresets = parseHashTagPresets(hashTagPresetsRaw);
  const subscription = validateSubscription(subscriptionRaw);
  const availablePlans = validateAvailablePlans(availablePlansRaw);
  const paymentHistory = validatePaymentHistory(paymentHistoryRaw);
  const mutedList = parseMutedList(mutedListRaw);

  // Get tab from URL search params
  const searchParams = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  );
  let defaultTab = searchParams.get("tab") ?? "general";
  if (
    (isChild && defaultTab === "subscription") ||
    (!hasAccountsAccess && defaultTab === "accounts")
  ) {
    defaultTab = "general";
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account preferences and posting configurations
        </p>
      </div>

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList
          className={`grid w-full ${!hasAccountsAccess && !isChild ? "grid-cols-5" : isChild ? "grid-cols-5" : "grid-cols-6"}`}
        >
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          {hasAccountsAccess ? (
            <TabsTrigger value="accounts">Accounts</TabsTrigger>
          ) : null}
          <TabsTrigger value="network">Network</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
          {!isChild ? (
            <TabsTrigger value="subscription">Subscription</TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="general" className="mt-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-1">
            <TimezoneSettings
              timezone={(timezone as string | null | undefined) ?? null}
            />
            <ScheduleIntervalsSettings
              scheduleIntervals={
                Array.isArray(scheduleIntervals)
                  ? (scheduleIntervals as string[])
                  : []
              }
            />
          </div>
        </TabsContent>

        <TabsContent value="content" className="mt-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-1">
            <HashtagPresetsSettings
              presets={hashTagPresets.map((p) => ({
                id: p.id,
                name: p.name,
                tags: p.tags,
                description: p.description ?? null,
                createdAt:
                  p.createdAt instanceof Date
                    ? p.createdAt.toISOString()
                    : typeof p.createdAt === "string"
                      ? p.createdAt
                      : new Date().toISOString(),
                updatedAt:
                  p.updatedAt instanceof Date
                    ? p.updatedAt.toISOString()
                    : typeof p.updatedAt === "string"
                      ? p.updatedAt
                      : new Date().toISOString(),
              }))}
            />
            <QueueTypesSettings
              queueTypes={queueTypes}
              hashTagPresets={hashTagPresets.map((p) => ({
                id: p.id,
                name: p.name,
                tags: p.tags,
                description: p.description ?? undefined,
              }))}
            />
          </div>
        </TabsContent>

        <TabsContent value="network" className="mt-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-1">
            <RelaysSettings
              relays={Array.isArray(relays) ? (relays as string[]) : []}
            />
            <GiveawayBlacklistSettings
              giveawayBlacklist={
                Array.isArray(giveawayBlacklist)
                  ? (giveawayBlacklist as string[])
                  : []
              }
            />
            <MutedListSettings
              mutedList={mutedList}
              filterMuted={
                typeof filterMuted === "boolean" ? filterMuted : false
              }
              hidePostsFromLowTrustUsers={
                typeof hidePostsFromLowTrustUsers === "boolean"
                  ? hidePostsFromLowTrustUsers
                  : false
              }
            />
          </div>
        </TabsContent>

        <TabsContent value="storage" className="mt-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-1">
            <UploadProviderSettings
              uploadProvider={
                typeof uploadProvider === "string" ? uploadProvider : ""
              }
            />
            <BlossomMediaMirrorsSettings
              enableMirrorBlossom={
                typeof enableMirrorBlossom === "boolean"
                  ? enableMirrorBlossom
                  : false
              }
              mirrorUploadUrls={
                Array.isArray(mirrorUploadUrls)
                  ? (mirrorUploadUrls as string[])
                  : []
              }
            />
          </div>
        </TabsContent>

        {!isChild ? (
          <TabsContent value="subscription" className="mt-6 space-y-6">
            <div className="grid gap-6 md:grid-cols-1">
              <SubscriptionSettings
                subscription={subscription}
                availablePlans={availablePlans}
                paymentHistory={paymentHistory}
              />
              <NWCSettings
                nwcEnabled={
                  typeof nwcEnabled === "boolean" ? nwcEnabled : false
                }
                maskedNwcString={
                  (maskedNwcString as string | null | undefined) ?? undefined
                }
                nwcLastUsed={
                  nwcLastUsed instanceof Date
                    ? nwcLastUsed.toISOString()
                    : typeof nwcLastUsed === "string"
                      ? nwcLastUsed
                      : null
                }
              />
            </div>
          </TabsContent>
        ) : null}

        {hasAccountsAccess ? (
          <TabsContent value="accounts" className="mt-6 space-y-6">
            <div className="grid gap-6 md:grid-cols-1">
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
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
