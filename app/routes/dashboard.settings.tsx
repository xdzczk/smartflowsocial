import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

import { RelaysSettings } from "~/components/settings/RelaysSettings";
import { TimezoneSettings } from "~/components/settings/TimezoneSettings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { requireUserId } from "~/features/auth";
import { MutedListSettings } from "~/features/engagement";
import { GiveawayBlacklistSettings } from "~/features/giveaway";
import type { ProfileData } from "~/features/nostr/types";
import {
  NWCSettings,
  SubscriptionSettings,
  requireFeatureAccess,
  requireAnySubscription,
} from "~/features/payments";
import {
  HashtagPresetsSettings,
  QueueTypesSettings,
  ScheduleIntervalsSettings,
  type HashTagPreset,
  type QueueType,
  convertJsonValueToScheduleConfig,
} from "~/features/posts";
import { handleSettingsAction } from "~/features/settings/settings-actions.server";
import { loadSettingsData } from "~/features/settings/settings-loader.server";
import {
  BlossomMediaMirrorsSettings,
  UploadProviderSettings,
} from "~/features/upload";
import { AccountsSettings } from "~/features/user";
import { withCSRFProtection } from "~/lib/csrf";
export async function loader({ request }: { request: Request }) {
  try {
    const userId = await requireUserId(request);

    // Require that the user has at least a subscription record
    await requireAnySubscription(userId);
    // Check if user has access to settings feature (requires active subscription)
    await requireFeatureAccess(userId, "settings");

    const data = await loadSettingsData(userId);
    return json(data);
  } catch (error) {
    // If error is a Response (e.g., redirect from requireUserId, requireAnySubscription, or requireFeatureAccess), return it
    if (error instanceof Response) {
      return error;
    }
    // Use dynamic import to avoid bundling issues
    const { handleLoaderError } = await import("~/lib/error-handler.server");
    // Provide default data structure matching what the component expects
    return handleLoaderError(error, {
      timezone: "Etc/GMT",
      relays: [],
      giveawayBlacklist: [],
      scheduleIntervals: [],
      queueTypes: [],
      uploadProvider: null,
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
      accounts: null,
      mutedList: { npubs: [], lastSynced: new Date().toISOString() },
      filterMuted: false,
      hidePostsFromLowTrustUsers: false,
    });
  }
}

export const action = withCSRFProtection(async ({ request }: { request: Request }) => {
  const userId = await requireUserId(request);
  const formData = await request.formData();

  try {
    return await handleSettingsAction(userId, formData);
  } catch (error) {
    // Use centralized error handling
    const { handleActionError } = await import("~/lib/error-handler.server");
    const { logError } = await import("~/lib/error-logger.server");
    const { normalizeError } = await import("~/lib/errors");

    // Log additional context for debugging
    const normalizedError = normalizeError(error);
    logError(normalizedError, {
      userId,
      path: request.url,
      method: request.method,
      action: formData.get("_action"),
      formDataEntries: Object.fromEntries(formData.entries()),
    });

    return handleActionError(error);
  }
});

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

export default function Settings() {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const loaderDataRaw = useLoaderData<typeof loader>();
  // Type assertion to avoid unsafe assignment errors from Remix JsonifyObject
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
    accounts,
    mutedList: mutedListRaw,
    filterMuted,
    hidePostsFromLowTrustUsers,
  } = data;

  // Type assertions for Remix JsonifyObject serialization
  const queueTypes: QueueTypeSettings[] = Array.isArray(queueTypesRaw)
    ? queueTypesRaw
        .map((qt: unknown) => {
          if (qt && typeof qt === "object" && "id" in qt && "name" in qt) {
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
            const result: QueueTypeSettings = {
              id: q.id,
              name: q.name,
              color: q.color,
              description: undefined,
              scheduleType: q.scheduleType as
                | "INTERVAL"
                | "FIXED_SLOTS"
                | undefined,
              scheduleConfig: convertJsonValueToScheduleConfig(
                q.scheduleConfig,
              ),
              isEnabled: q.isEnabled,
              isDefault: q.isDefault ?? false,
              hashTagPresetId: q.hashTagPresetId,
              hashTagPreset: q.hashTagPreset,
            };
            return result;
          }
          return null;
        })
        .filter((qt): qt is QueueTypeSettings => qt !== null)
    : [];
  const hashTagPresets: HashTagPreset[] = Array.isArray(hashTagPresetsRaw)
    ? hashTagPresetsRaw
        .filter(
          (
            preset: unknown,
          ): preset is {
            id: string;
            name: string;
            tags: string;
            description?: unknown;
            createdAt?: unknown;
            updatedAt?: unknown;
            userId?: unknown;
          } =>
            typeof preset === "object" &&
            preset !== null &&
            "id" in preset &&
            "name" in preset &&
            "tags" in preset &&
            typeof (preset as { id: unknown; name: unknown; tags: unknown })
              .id === "string" &&
            typeof (preset as { id: unknown; name: unknown; tags: unknown })
              .name === "string" &&
            typeof (preset as { id: unknown; name: unknown; tags: unknown })
              .tags === "string",
        )
        .map((preset) => ({
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
          createdAt: (() => {
            const createdAtValue: unknown = preset.createdAt;
            if (createdAtValue === null || createdAtValue === undefined)
              return undefined;
            if (createdAtValue instanceof Date) return createdAtValue;
            if (typeof createdAtValue === "string")
              return new Date(createdAtValue);
            return undefined;
          })(),
          updatedAt: (() => {
            const updatedAtValue: unknown = preset.updatedAt;
            if (updatedAtValue === null || updatedAtValue === undefined)
              return undefined;
            if (updatedAtValue instanceof Date) return updatedAtValue;
            if (typeof updatedAtValue === "string")
              return new Date(updatedAtValue);
            return undefined;
          })(),
        }))
    : [];
  const subscription =
    subscriptionRaw && typeof subscriptionRaw === "object"
      ? (subscriptionRaw as unknown as {
          id: string;
          planId: string | null;
          status: string;
          currentPeriodEnd: Date | string | null;
        } | null)
      : null;
  const availablePlans = Array.isArray(availablePlansRaw)
    ? (availablePlansRaw as unknown as {
        id: string;
        name: string;
        price: number;
      }[])
    : [];
  const paymentHistory = Array.isArray(paymentHistoryRaw)
    ? paymentHistoryRaw.map((p: unknown) => {
        const ph = p as {
          id: string;
          amount: number;
          createdAt: Date | string;
        };
        return {
          ...ph,
          createdAt:
            ph.createdAt instanceof Date
              ? ph.createdAt
              : new Date(ph.createdAt),
        };
      })
    : [];
  const mutedListRawTyped = mutedListRaw as { npubs?: unknown; lastSynced?: unknown } | null | undefined;
  const mutedList =
    mutedListRawTyped &&
    typeof mutedListRawTyped === "object" &&
    !Array.isArray(mutedListRawTyped)
      ? {
          npubs: Array.isArray(mutedListRawTyped.npubs)
            ? (mutedListRawTyped.npubs as string[])
            : [],
          lastSynced:
            typeof mutedListRawTyped.lastSynced === "string"
              ? mutedListRawTyped.lastSynced
              : new Date().toISOString(),
        }
      : { npubs: [], lastSynced: new Date().toISOString() };

  // Get tab from URL search params
  const searchParams = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : "",
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
        <p className="mt-2 text-muted-foreground">
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
            <TimezoneSettings timezone={(timezone as string | null | undefined) ?? null} />
            <ScheduleIntervalsSettings scheduleIntervals={Array.isArray(scheduleIntervals) ? (scheduleIntervals as string[]) : []} />
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
            <RelaysSettings relays={Array.isArray(relays) ? (relays as string[]) : []} />
            <GiveawayBlacklistSettings giveawayBlacklist={Array.isArray(giveawayBlacklist) ? (giveawayBlacklist as string[]) : []} />
            <MutedListSettings
              mutedList={mutedList}
              filterMuted={typeof filterMuted === "boolean" ? filterMuted : false}
              hidePostsFromLowTrustUsers={typeof hidePostsFromLowTrustUsers === "boolean" ? hidePostsFromLowTrustUsers : false}
            />
          </div>
        </TabsContent>

        <TabsContent value="storage" className="mt-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-1">
            <UploadProviderSettings uploadProvider={typeof uploadProvider === "string" ? uploadProvider : ""} />
            <BlossomMediaMirrorsSettings
              enableMirrorBlossom={typeof enableMirrorBlossom === "boolean" ? enableMirrorBlossom : false}
              mirrorUploadUrls={Array.isArray(mirrorUploadUrls) ? (mirrorUploadUrls as string[]) : []}
            />
          </div>
        </TabsContent>

        {!isChild ? (
          <TabsContent value="subscription" className="mt-6 space-y-6">
            <div className="grid gap-6 md:grid-cols-1">
              <SubscriptionSettings
                subscription={
                  subscription as unknown as {
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
                  } | null
                }
                availablePlans={
                  availablePlans as unknown as {
                    id: string;
                    name: string;
                    price: number;
                    enableLifetimeAccess: boolean;
                  }[]
                }
                paymentHistory={
                  paymentHistory as unknown as {
                    id: string;
                    amount: number;
                    amountUsd: number | null;
                    description: string | null;
                    paidAt: Date | null;
                    paymentMethod: string | null;
                    paymentHash: string;
                    planName?: string;
                    planPrice?: number;
                  }[]
                }
              />
              <NWCSettings
                nwcEnabled={typeof nwcEnabled === "boolean" ? nwcEnabled : false}
                maskedNwcString={(maskedNwcString as string | null | undefined) ?? undefined}
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
                  parentNpub={((accounts as { parentNpub?: unknown }).parentNpub as string | undefined) ?? undefined}
                  confirmedChildren={Array.isArray((accounts as { confirmedChildren?: unknown }).confirmedChildren) ? (accounts as { confirmedChildren: unknown[] }).confirmedChildren as unknown as Array<{ npub: string; nostrProfile?: ProfileData | null }> : undefined}
                  pendingChildren={Array.isArray((accounts as { pendingChildren?: unknown }).pendingChildren) ? (accounts as { pendingChildren: unknown[] }).pendingChildren as unknown as Array<{ npub: string; nostrProfile?: ProfileData | null }> : undefined}
                  isChild={typeof (accounts as { isChild?: unknown }).isChild === "boolean" ? (accounts as { isChild: boolean }).isChild : false}
                  parentUser={(accounts as { parentUser?: unknown }).parentUser as { npub: string; nostrProfile?: ProfileData | null } | null | undefined}
                />
              ) : (
                <div className="text-sm text-muted-foreground">
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
