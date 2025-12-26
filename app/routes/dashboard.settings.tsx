import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

import { RelaysSettings } from "~/components/settings/RelaysSettings";
import { TimezoneSettings } from "~/components/settings/TimezoneSettings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { requireUserId } from "~/features/auth/session.server";
import { MutedListSettings } from "~/features/engagement/components/MutedListSettings";
import { GiveawayBlacklistSettings } from "~/features/giveaway/components/GiveawayBlacklistSettings";
import { NWCSettings } from "~/features/payments/components/NWCSettings";
import { HashtagPresetsSettings } from "~/features/posts/components/HashtagPresetsSettings";
import { QueueTypesSettings } from "~/features/posts/components/QueueTypesSettings";
import { ScheduleIntervalsSettings } from "~/features/posts/components/ScheduleIntervalsSettings";
import { SubscriptionSettings } from "~/features/payments/components/SubscriptionSettings";
import { BlossomMediaMirrorsSettings } from "~/features/upload/components/BlossomMediaMirrorsSettings";
import { UploadProviderSettings } from "~/features/upload/components/UploadProviderSettings";
import { AccountsSettings } from "~/features/user/components/AccountsSettings";
import { requireFeatureAccess, requireAnySubscription } from "~/features/payments/subscriptions.server";
import { loadSettingsData } from "~/features/settings/settings-loader.server";
import { handleSettingsAction } from "~/features/settings/settings-actions.server";

export async function loader({ request }: { request: Request }) {
  const userId = await requireUserId(request);

  // Require that the user has at least a subscription record
  await requireAnySubscription(userId);
  // Check if user has access to settings feature (requires active subscription)
  await requireFeatureAccess(userId, "settings");

  const data = await loadSettingsData(userId);
  return json(data);
}

export async function action({ request }: { request: Request }) {
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
}

export default function Settings() {
  const {
    timezone,
    relays,
    giveawayBlacklist,
    scheduleIntervals,
    queueTypes,
    uploadProvider,
    enableMirrorBlossom,
    mirrorUploadUrls,
    hashTagPresets,
    nwcEnabled,
    maskedNwcString,
    nwcLastUsed,
    subscription,
    availablePlans,
    paymentHistory,
    isChild,
    hasAccountsAccess,
    accounts,
    mutedList,
    filterMuted,
    hidePostsFromLowTrustUsers,
  } = useLoaderData<typeof loader>();

  // Get tab from URL search params
  const searchParams = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : "",
  );
  let defaultTab = searchParams.get("tab") || "general";
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
          {hasAccountsAccess ? <TabsTrigger value="accounts">Accounts</TabsTrigger> : null}
          <TabsTrigger value="network">Network</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
          {!isChild ? <TabsTrigger value="subscription">Subscription</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="general" className="mt-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-1">
            <TimezoneSettings timezone={timezone} />
            <ScheduleIntervalsSettings scheduleIntervals={scheduleIntervals} />
          </div>
        </TabsContent>

        <TabsContent value="content" className="mt-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-1">
            <HashtagPresetsSettings presets={hashTagPresets} />
            <QueueTypesSettings
              queueTypes={queueTypes}
              hashTagPresets={hashTagPresets}
            />
          </div>
        </TabsContent>

        <TabsContent value="network" className="mt-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-1">
            <RelaysSettings relays={relays} />
            <GiveawayBlacklistSettings giveawayBlacklist={giveawayBlacklist} />
            <MutedListSettings
              mutedList={mutedList}
              filterMuted={filterMuted}
              hidePostsFromLowTrustUsers={hidePostsFromLowTrustUsers}
            />
          </div>
        </TabsContent>

        <TabsContent value="storage" className="mt-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-1">
            <UploadProviderSettings uploadProvider={uploadProvider} />
            <BlossomMediaMirrorsSettings
              enableMirrorBlossom={enableMirrorBlossom}
              mirrorUploadUrls={mirrorUploadUrls}
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
                nwcEnabled={nwcEnabled}
                maskedNwcString={maskedNwcString ?? undefined}
                nwcLastUsed={nwcLastUsed}
              />
            </div>
          </TabsContent>
        ) : null}

        {hasAccountsAccess ? (
          <TabsContent value="accounts" className="mt-6 space-y-6">
            <div className="grid gap-6 md:grid-cols-1">
              {accounts ? (
                <AccountsSettings
                  parentNpub={accounts.parentNpub ?? undefined}
                  confirmedChildren={accounts.confirmedChildren}
                  pendingChildren={accounts.pendingChildren}
                  isChild={accounts.isChild}
                  parentUser={accounts.parentUser}
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
