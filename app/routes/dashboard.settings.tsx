import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

import { RelaysSettings } from "~/components/settings/RelaysSettings";
import { TimezoneSettings } from "~/components/settings/TimezoneSettings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { validateNpub } from "~/features/auth/profile.server";
import { requireUserId } from "~/features/auth/session.server";
import { MutedListSettings } from "~/features/engagement/components/MutedListSettings";
import { fetchMutedList } from "~/features/engagement/mutedList.server";
import { GiveawayBlacklistSettings } from "~/features/giveaway/components/GiveawayBlacklistSettings";
import { NWCSettings } from "~/features/payments/components/NWCSettings";
import { HashtagPresetsSettings } from "~/features/posts/components/HashtagPresetsSettings";
import { QueueTypesSettings } from "~/features/posts/components/QueueTypesSettings";
import { ScheduleIntervalsSettings } from "~/features/posts/components/ScheduleIntervalsSettings";
import { SubscriptionSettings } from "~/features/payments/components/SubscriptionSettings";
import { BlossomMediaMirrorsSettings } from "~/features/upload/components/BlossomMediaMirrorsSettings";
import { UploadProviderSettings } from "~/features/upload/components/UploadProviderSettings";
import { AccountsSettings } from "~/features/user/components/AccountsSettings";
import { hexToNpub } from "~/lib/nostr";
import {
  getUserSubscription,
  getAllPlans,
  updateUserSubscription,
  getUserPaymentHistory,
  getPlanById,
} from "~/models/payment.server";
import {
  updateUserTimezone,
  getUserTimezone,
  getUserRelays,
  updateUserRelays,
  getShowHashTagsInPosts,
  updateGiveawayBlacklist,
  getGiveawayBlacklist,
  updateScheduleInterval,
  getScheduleInterval,
  getQueueTypes,
  updateQueueType,
  deleteQueueType,
  getUserUploadProvider,
  updateUserUploadProvider,
  getUserEnableMirrorBlossom,
  updateUserEnableMirrorBlossom,
  getUserMirrorUploadUrls,
  updateUserMirrorUploadUrls,
  getUserHashTagPresets,
  createHashTagPreset,
  updateHashTagPreset,
  deleteHashTagPreset,
  getUserNWC,
  updateUserNWC,
  updateUserNWCEnabled,
  clearUserNWC,
  searchUsersByProfileName,
  requestChildLink,
  cancelChildLinkRequest,
  getConfirmedChildrenForParent,
  getPendingChildrenForParent,
  unlinkParent,
  unlinkChildByParent,
  getUserMutedList,
  getUserFilterMuted,
  getUserHidePostsFromLowTrustUsers,
  updateUserMutedList,
  updateUserFilterMuted,
  updateUserHidePostsFromLowTrustUsers as updateUserHideLowTrust,
  getUserBasicInfo,
  getUserByNpubWithProfile,
  hashTagPresetExistsForUser,
  getUserIdByNpub,
} from "~/models/user.server";
import { requireFeatureAccess, requireAnySubscription } from "~/features/payments/subscriptions.server";

export async function loader({ request }: { request: Request }) {
  const userId = await requireUserId(request);

  // Require that the user has at least a subscription record
  await requireAnySubscription(userId);
  // Check if user has access to settings feature (requires active subscription)
  await requireFeatureAccess(userId, "settings");

  // Get subscription and plan name for gating Accounts tab
  const currentSub = await getUserSubscription(userId);
  const planName = currentSub?.Plan?.name || null;

  const userRecord = await getUserBasicInfo(userId);
  const myNpub = userRecord?.npub as string;
  const isChild = !!userRecord?.isChild;
  const hasAccountsAccess =
    isChild || planName === "Founder" || planName === "Premium";

  const timezone = await getUserTimezone(userId);
  const relays = await getUserRelays(userId);
  const giveawayBlacklist = await getGiveawayBlacklist(userId);
  const showHashTagsInPosts = await getShowHashTagsInPosts(userId);
  const scheduleIntervals = await getScheduleInterval(userId);
  const queueTypes = await getQueueTypes(userId);
  const uploadProvider = await getUserUploadProvider(userId);
  const enableMirrorBlossom = await getUserEnableMirrorBlossom(userId);
  const mirrorUploadUrls = await getUserMirrorUploadUrls(userId);
  const hashTagPresets = await getUserHashTagPresets(userId);
  const nwcSettings = await getUserNWC(userId);
  const mutedList = await getUserMutedList(userId);
  const filterMuted = await getUserFilterMuted(userId);
  const hidePostsFromLowTrustUsers = await getUserHidePostsFromLowTrustUsers(userId);

  // Accounts data
  let accounts: any = {};
  if (isChild) {
    const parentUser = userRecord?.parentNpub
      ? await getUserByNpubWithProfile(userRecord.parentNpub)
      : null;
    accounts = {
      isChild: true,
      parentNpub: parentUser?.npub || null,
      parentUser,
      confirmedChildren: [],
      pendingChildren: [],
    };
  } else {
    const parentNpub = myNpub;
    const confirmedChildren = parentNpub
      ? await getConfirmedChildrenForParent(parentNpub)
      : [];
    const pendingChildren = parentNpub
      ? await getPendingChildrenForParent(parentNpub)
      : [];
    accounts = {
      isChild: false,
      parentNpub,
      confirmedChildren,
      pendingChildren,
    };
  }

  // Get subscription information
  const subscription = await getUserSubscription(userId);
  const allPlans = await getAllPlans();
  const paymentHistory = await getUserPaymentHistory(userId);

  return json({
    timezone,
    relays,
    showHashTagsInPosts,
    giveawayBlacklist,
    scheduleIntervals,
    queueTypes: queueTypes as unknown as typeof queueTypes,
    uploadProvider,
    enableMirrorBlossom,
    mirrorUploadUrls,
    hashTagPresets: hashTagPresets as unknown as typeof hashTagPresets,
    nwcEnabled: nwcSettings.enabled,
    maskedNwcString: nwcSettings.maskedString,
    nwcLastUsed: nwcSettings.lastUsed,
    subscription: subscription
      ? {
        id: subscription.id,
        planId: subscription.planId,
        status: subscription.status,
        startDate: subscription.startDate,
        currentPeriodEnd: subscription.currentPeriodEnd,
        nextPaymentDue: subscription.nextPaymentDue,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        plan: subscription.Plan
          ? {
            id: subscription.Plan.id,
            name: subscription.Plan.name,
            price: subscription.Plan.price,
            enableLifetimeAccess: subscription.Plan.enableLifetimeAccess,
          }
          : null,
      }
      : null,
    availablePlans: allPlans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      price: plan.price,
      enableLifetimeAccess: plan.enableLifetimeAccess,
    })),
    paymentHistory: paymentHistory.map((payment) => ({
      id: payment.id,
      amount: payment.amount,
      amountUsd: payment.amountUsd,
      description: payment.description,
      paidAt: payment.paidAt,
      paymentMethod: payment.paymentMethod,
      paymentHash: payment.paymentHash,
      planName: payment.Subscription?.Plan?.name,
      planPrice: payment.Subscription?.Plan?.price,
    })),
    isChild,
    hasAccountsAccess,
    accounts,
    mutedList,
    filterMuted,
    hidePostsFromLowTrustUsers,
  });
}

export async function action({ request }: { request: Request }) {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const _action = formData.get("_action") as string;

  if (!_action) {
    return json({ error: "Action is required" }, { status: 400 });
  }

  try {
    if (_action === "create_hashtag_preset") {
      const name = formData.get("name") as string;
      const tags = formData.get("tags") as string;
      const description = formData.get("description") as string;

      if (!name.trim() || !tags.trim()) {
        return json({ error: "Name and tags are required" }, { status: 400 });
      }

      await createHashTagPreset(userId, name, tags, description || undefined);
      return json({ success: true });
    }

    if (_action === "update_hashtag_preset") {
      const id = formData.get("id") as string;
      const name = formData.get("name") as string;
      const tags = formData.get("tags") as string;
      const description = formData.get("description") as string;

      if (!id || !name.trim() || !tags.trim()) {
        return json(
          { error: "ID, name and tags are required" },
          { status: 400 },
        );
      }

      await updateHashTagPreset(
        userId,
        id,
        name,
        tags,
        description || undefined,
      );
      return json({ success: true });
    }

    if (_action === "delete_hashtag_preset") {
      const id = formData.get("id") as string;

      if (!id) {
        return json({ error: "ID is required" }, { status: 400 });
      }

      await deleteHashTagPreset(userId, id);
      return json({ success: true });
    }

    if (_action === "update_timezone") {
      const timezone = formData.get("timezone") as string;
      await updateUserTimezone(userId, timezone);
      return json({ success: true });
    }

    if (_action === "update_relays") {
      const relays = (formData.get("relays") as string)
        .split("\n")
        .filter((relay) => relay.trim());
      await updateUserRelays(userId, relays);
      return json({ success: true });
    }

    if (_action === "update_blacklist") {
      const blacklistItems = (formData.get("blacklist") as string)
        .split("\n")
        .filter((item) => item.trim());

      const invalidItems = blacklistItems.filter(
        (item) => !item.startsWith("npub"),
      );
      if (invalidItems.length > 0) {
        return json(
          { error: "All blacklist items must start with npub" },
          { status: 400 },
        );
      }

      await updateGiveawayBlacklist(userId, blacklistItems);
      return json({ success: true });
    }

    if (_action === "update_schedule_intervals") {
      const intervals = (formData.get("scheduleIntervals") as string)
        .split("\n")
        .filter((interval) => interval.trim());

      const invalidIntervals = intervals.filter((interval) => {
        const num = parseInt(interval, 10);
        return isNaN(num) || num <= 0 || num.toString() !== interval.trim();
      });

      if (invalidIntervals.length > 0) {
        return json(
          { error: "All schedule intervals must be positive whole numbers" },
          { status: 400 },
        );
      }

      await updateScheduleInterval(userId, intervals);
      return json({ success: true });
    }

    if (_action === "create_queue_type") {
      // Check if user has a free subscription
      const subscription = await getUserSubscription(userId);
      if (subscription?.Plan && Number(subscription.Plan.price) === 0) {
        return json(
          {
            error:
              "Creating queue types is not available on the free plan. Please upgrade your subscription.",
          },
          { status: 403 },
        );
      }

      const name = formData.get("name") as string;
      const scheduleType = formData.get("scheduleType") as
        | "INTERVAL"
        | "FIXED_SLOTS";
      const color = formData.get("color") as string;
      const description = formData.get("description") as string;
      const hashTagPresetId = formData.get("hashTagPresetId") as string;
      const processedHashTagPresetId =
        hashTagPresetId === "none" || !hashTagPresetId ? null : hashTagPresetId;

      // Validate hashtag preset exists if provided
      if (processedHashTagPresetId) {
        const presetExists = await hashTagPresetExistsForUser(userId, processedHashTagPresetId);
        if (!presetExists) {
          return json(
            { error: "Selected hashtag preset does not exist" },
            { status: 400 },
          );
        }
      }

      let scheduleConfig = {};
      if (scheduleType === "INTERVAL") {
        const intervalHours = parseInt(
          formData.get("intervalHours") as string,
          10,
        );
        const useGlobalInterval = formData.get("useGlobalInterval") === "on";
        scheduleConfig = useGlobalInterval
          ? { useGlobalInterval: true }
          : { intervalHours };
      } else if (scheduleType === "FIXED_SLOTS") {
        const slots = (formData.get("slots") as string)
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s);
        scheduleConfig = { slots };
      }

      await updateQueueType(userId, {
        name,
        scheduleType,
        scheduleConfig,
        color,
        description,
        hashTagPresetId: processedHashTagPresetId,
      });
      return json({ success: true });
    }

    if (_action === "update_queue_type") {
      const id = formData.get("id") as string;
      const name = formData.get("name") as string;
      const scheduleType = formData.get("scheduleType") as
        | "INTERVAL"
        | "FIXED_SLOTS";
      const color = formData.get("color") as string;
      const description = formData.get("description") as string;
      const isEnabled = formData.get("isEnabled") === "on";
      const hashTagPresetId = formData.get("hashTagPresetId") as string;
      const processedHashTagPresetId =
        hashTagPresetId === "none" || !hashTagPresetId ? null : hashTagPresetId;

      // Validate hashtag preset exists if provided
      if (processedHashTagPresetId) {
        const presetExists = await hashTagPresetExistsForUser(userId, processedHashTagPresetId);
        if (!presetExists) {
          return json(
            { error: "Selected hashtag preset does not exist" },
            { status: 400 },
          );
        }
      }

      let scheduleConfig = {};
      if (scheduleType === "INTERVAL") {
        const intervalHours = parseInt(
          formData.get("intervalHours") as string,
          10,
        );
        const useGlobalInterval = formData.get("useGlobalInterval") === "on";
        scheduleConfig = useGlobalInterval
          ? { useGlobalInterval: true }
          : { intervalHours };
      } else if (scheduleType === "FIXED_SLOTS") {
        const slots = (formData.get("slots") as string)
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s);
        scheduleConfig = { slots };
      }

      await updateQueueType(userId, {
        id,
        name,
        scheduleType,
        scheduleConfig,
        color,
        description,
        isEnabled,
        hashTagPresetId: processedHashTagPresetId,
      });
      return json({ success: true });
    }

    if (_action === "delete_queue_type") {
      const id = formData.get("id") as string;
      await deleteQueueType(userId, id);
      return json({ success: true });
    }

    if (_action === "update_upload_provider") {
      const uploadProvider = formData.get("uploadProvider") as
        | "S3"
        | "BLOSSOM_PRIMAL"
        | "BLOSSOM_BLOSSTR";

      if (
        !uploadProvider ||
        !["S3", "BLOSSOM_PRIMAL", "BLOSSOM_BLOSSTR"].includes(uploadProvider)
      ) {
        return json({ error: "Invalid upload provider" }, { status: 400 });
      }

      await updateUserUploadProvider(userId, uploadProvider);
      return json({ success: true });
    }

    if (_action === "update_blossom_mirrors") {
      const enableMirrorBlossom = formData.get("enableMirrorBlossom") === "on";
      const rawUrls = (formData.get("mirrorUrls") as string)
        .split("\n")
        .filter((url) => url.trim());

      // Clean and validate URLs
      const cleanedUrls: string[] = [];
      for (const url of rawUrls) {
        const trimmedUrl = url.trim();

        // Check if URL starts with https://
        if (!trimmedUrl.startsWith("https://")) {
          return json(
            { error: "All mirror URLs must start with https://" },
            { status: 400 },
          );
        }

        // Validate URL format
        try {
          new URL(trimmedUrl);
        } catch {
          return json(
            { error: "Invalid URL format in mirror URLs" },
            { status: 400 },
          );
        }

        // Clean URL by removing trailing slash
        const cleanedUrl = trimmedUrl.endsWith("/")
          ? trimmedUrl.slice(0, -1)
          : trimmedUrl;
        cleanedUrls.push(cleanedUrl);
      }

      await updateUserEnableMirrorBlossom(userId, enableMirrorBlossom);
      await updateUserMirrorUploadUrls(userId, cleanedUrls);
      return json({ success: true });
    }

    if (_action === "update_nwc") {
      const nwcEnabled = formData.get("nwcEnabled") === "on";
      const nwcString = formData.get("nwcString") as string;

      if (nwcEnabled && nwcString?.trim()) {
        // Update with new NWC string
        await updateUserNWC(userId, nwcString.trim(), true);
      } else {
        // Just update enabled status
        await updateUserNWCEnabled(userId, nwcEnabled);
      }
      return json({ success: true });
    }

    if (_action === "clear_nwc") {
      await clearUserNWC(userId);
      return json({ success: true });
    }

    if (_action === "search_accounts") {
      const q = (formData.get("q") as string) || "";
      const me = await getUserBasicInfo(userId);
      if (me?.isChild) {
        return json(
          { error: "Child accounts cannot search or manage child accounts." },
          { status: 403 },
        );
      }
      const sub = await getUserSubscription(userId);
      const planName = sub?.Plan?.name || "";
      if (!(planName === "Founder" || planName === "Premium")) {
        return json(
          {
            error:
              "Accounts management requires Founder or Premium. Please upgrade.",
          },
          { status: 403 },
        );
      }
      const results = await searchUsersByProfileName(q, me?.npub);
      return json({ results });
    }

    if (_action === "request_child") {
      const childHex = (formData.get("childNpub") as string) || "";
      if (!/^[0-9a-fA-F]{64}$/.test(childHex)) {
        return json({ error: "Invalid child hex pubkey" }, { status: 400 });
      }
      const me = await getUserBasicInfo(userId);
      if (me?.isChild) {
        return json(
          { error: "Child accounts cannot link child accounts." },
          { status: 403 },
        );
      }
      const sub = await getUserSubscription(userId);
      const planName = sub?.Plan?.name || "";
      if (!(planName === "Founder" || planName === "Premium")) {
        return json(
          {
            error:
              "Accounts management requires Founder or Premium. Please upgrade.",
          },
          { status: 403 },
        );
      }
      const parentNpub = me?.npub || "";
      const res = await requestChildLink(parentNpub, childHex);
      if (!res.ok) {
        return json({ error: res.reason }, { status: 400 });
      }
      return json({ success: true });
    }

    if (_action === "cancel_child_request") {
      const childHex = (formData.get("childNpub") as string) || "";
      if (!/^[0-9a-fA-F]{64}$/.test(childHex)) {
        return json({ error: "Invalid child hex pubkey" }, { status: 400 });
      }
      const me = await getUserBasicInfo(userId);
      if (me?.isChild) {
        return json(
          { error: "Child accounts cannot manage child requests." },
          { status: 403 },
        );
      }
      const sub = await getUserSubscription(userId);
      const planName = sub?.Plan?.name || "";
      if (!(planName === "Founder" || planName === "Premium")) {
        return json(
          {
            error:
              "Accounts management requires Founder or Premium. Please upgrade.",
          },
          { status: 403 },
        );
      }
      const res = await cancelChildLinkRequest(me?.npub || "", childHex);
      if (!res.ok) {
        return json({ error: res.reason }, { status: 400 });
      }
      return json({ success: true });
    }

    if (_action === "unlink_parent") {
      const me = await getUserBasicInfo(userId);
      if (!me?.isChild) {
        return json(
          { error: "This account is not a child account." },
          { status: 400 },
        );
      }
      const res = await unlinkParent(me.npub);
      if (!res.ok) {
        return json({ error: res.reason }, { status: 400 });
      }
      // Demote child back to free plan
      try {
        await updateUserSubscription(
          userId,
          "free",
          `free_child_unlink_${Date.now()}_${userId}`,
        );
      } catch (e) {
        console.warn("Failed to demote child to free after unlink:", e);
      }
      return json({ success: true });
    }

    if (_action === "unlink_child") {
      const childNpub = (formData.get("childNpub") as string) || "";
      if (!/^[0-9a-fA-F]{64}$/.test(childNpub)) {
        return json({ error: "Invalid child hex pubkey" }, { status: 400 });
      }
      const me = await getUserBasicInfo(userId);
      if (!me?.npub || me.isChild) {
        return json(
          { error: "Only a parent account can unlink a child." },
          { status: 403 },
        );
      }
      const sub = await getUserSubscription(userId);
      const planName = sub?.Plan?.name || "";
      if (!(planName === "Founder" || planName === "Premium")) {
        return json(
          {
            error:
              "Accounts management requires Founder or Premium. Please upgrade.",
          },
          { status: 403 },
        );
      }
      const res = await unlinkChildByParent(me.npub, childNpub);
      if (!res.ok) {
        return json({ error: res.reason }, { status: 400 });
      }
      // Demote child to free plan
      try {
        const childId = await getUserIdByNpub(childNpub);
        if (childId) {
          await updateUserSubscription(
            childId,
            "free",
            `free_child_unlink_${Date.now()}_${childId}`,
          );
        }
      } catch (e) {
        console.warn("Failed to demote unlinked child to free:", e);
      }
      return json({ success: true });
    }

    if (_action === "switch_to_free_plan") {
      const planId = formData.get("planId") as string;

      if (!planId) {
        return json({ error: "Plan ID is required" }, { status: 400 });
      }

      // Get the plan to verify it's free
      const plan = await getPlanById(planId);

      if (!plan) {
        return json({ error: "Plan not found" }, { status: 400 });
      }

      if (Number(plan.price) > 0) {
        return json(
          { error: "This action is only allowed for free plans" },
          { status: 400 },
        );
      }

      // Update user subscription to free plan immediately
      await updateUserSubscription(
        userId,
        planId,
        `free_${Date.now()}_${userId}`,
      );

      return json({
        success: true,
        message: "Successfully switched to free plan",
      });
    }

    if (_action === "sync_muted_list") {
      // Get user's npub/pubkey
      const userInfo = await getUserBasicInfo(userId);

      if (!userInfo?.npub) {
        return json({ error: "User not found" }, { status: 404 });
      }

      // Fetch muted list from Primal cache
      const mutedListData = await fetchMutedList(userInfo.npub);

      if (!mutedListData) {
        return json(
          { error: "Failed to fetch muted list from Nostr" },
          { status: 500 },
        );
      }

      // Update user's muted list in database
      await updateUserMutedList(userId, mutedListData);

      return json({
        success: true,
        mutedList: mutedListData,
      });
    }

    if (_action === "toggle_filter_muted") {
      const filterMuted = formData.get("filterMuted") === "true";
      await updateUserFilterMuted(userId, filterMuted);

      return json({ success: true, filterMuted });
    }

    if (_action === "toggle_hide_low_trust") {
      const hidePostsFromLowTrustUsers = formData.get("hidePostsFromLowTrustUsers") === "true";
      await updateUserHideLowTrust(userId, hidePostsFromLowTrustUsers);

      return json({ success: true, hidePostsFromLowTrustUsers });
    }

    return json({ error: "Invalid action type" }, { status: 400 });
  } catch (error) {
    console.error(`Action error for ${_action}:`, error);

    // Log the form data for debugging
    const formDataEntries = Object.fromEntries(formData.entries());
    console.error("Form data:", formDataEntries);

    return json(
      {
        error: `Failed to process ${_action}: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 },
    );
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

        {!isChild ? <TabsContent value="subscription" className="mt-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-1">
            <SubscriptionSettings
              subscription={subscription}
              availablePlans={availablePlans}
              paymentHistory={paymentHistory}
            />
            <NWCSettings
              nwcEnabled={nwcEnabled}
              maskedNwcString={maskedNwcString}
              nwcLastUsed={nwcLastUsed}
            />
          </div>
        </TabsContent> : null}

        {hasAccountsAccess ? <TabsContent value="accounts" className="mt-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-1">
            {accounts ? (
              <AccountsSettings
                parentNpub={accounts.parentNpub}
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
        </TabsContent> : null}
      </Tabs>
    </div>
  );
}
