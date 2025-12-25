/**
 * Settings action handlers
 * Centralized handlers for all settings-related actions
 */

import { json } from "@remix-run/node";
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
import { fetchMutedList } from "~/features/engagement/mutedList.server";

/**
 * Handle hashtag preset actions
 */
async function handleHashtagPresetAction(
  userId: string,
  action: string,
  formData: FormData,
) {
  if (action === "create_hashtag_preset") {
    const name = formData.get("name") as string;
    const tags = formData.get("tags") as string;
    const description = formData.get("description") as string;

    if (!name.trim() || !tags.trim()) {
      return json({ error: "Name and tags are required" }, { status: 400 });
    }

    await createHashTagPreset(userId, name, tags, description || undefined);
    return json({ success: true });
  }

  if (action === "update_hashtag_preset") {
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

  if (action === "delete_hashtag_preset") {
    const id = formData.get("id") as string;

    if (!id) {
      return json({ error: "ID is required" }, { status: 400 });
    }

    await deleteHashTagPreset(userId, id);
    return json({ success: true });
  }

  return null;
}

/**
 * Handle general settings actions
 */
async function handleGeneralSettingsAction(
  userId: string,
  action: string,
  formData: FormData,
) {
  if (action === "update_timezone") {
    const timezone = formData.get("timezone") as string;
    await updateUserTimezone(userId, timezone);
    return json({ success: true });
  }

  if (action === "update_relays") {
    const relays = (formData.get("relays") as string)
      .split("\n")
      .filter((relay) => relay.trim());
    await updateUserRelays(userId, relays);
    return json({ success: true });
  }

  if (action === "update_blacklist") {
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

  if (action === "update_schedule_intervals") {
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

  return null;
}

/**
 * Handle queue type actions
 */
async function handleQueueTypeAction(
  userId: string,
  action: string,
  formData: FormData,
) {
  if (action === "create_queue_type") {
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

  if (action === "update_queue_type") {
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

  if (action === "delete_queue_type") {
    const id = formData.get("id") as string;
    await deleteQueueType(userId, id);
    return json({ success: true });
  }

  return null;
}

/**
 * Handle storage settings actions
 */
async function handleStorageSettingsAction(
  userId: string,
  action: string,
  formData: FormData,
) {
  if (action === "update_upload_provider") {
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

  if (action === "update_blossom_mirrors") {
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

  return null;
}

/**
 * Handle NWC (Nostr Wallet Connect) actions
 */
async function handleNWCAction(
  userId: string,
  action: string,
  formData: FormData,
) {
  if (action === "update_nwc") {
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

  if (action === "clear_nwc") {
    await clearUserNWC(userId);
    return json({ success: true });
  }

  return null;
}

/**
 * Handle accounts management actions
 */
async function handleAccountsAction(
  userId: string,
  action: string,
  formData: FormData,
) {
  const me = await getUserBasicInfo(userId);
  const sub = await getUserSubscription(userId);
  const planName = sub?.Plan?.name || "";

  // Check access for account management actions
  const requiresPremium = ["search_accounts", "request_child", "cancel_child_request", "unlink_child"].includes(action);
  if (requiresPremium && !(planName === "Founder" || planName === "Premium")) {
    return json(
      {
        error:
          "Accounts management requires Founder or Premium. Please upgrade.",
      },
      { status: 403 },
    );
  }

  if (action === "search_accounts") {
    const q = (formData.get("q") as string) || "";
    if (me?.isChild) {
      return json(
        { error: "Child accounts cannot search or manage child accounts." },
        { status: 403 },
      );
    }
    const results = await searchUsersByProfileName(q, me?.npub ?? undefined);
    return json({ results });
  }

  if (action === "request_child") {
    const childHex = (formData.get("childNpub") as string) || "";
    if (!/^[0-9a-fA-F]{64}$/.test(childHex)) {
      return json({ error: "Invalid child hex pubkey" }, { status: 400 });
    }
    if (me?.isChild) {
      return json(
        { error: "Child accounts cannot link child accounts." },
        { status: 403 },
      );
    }
    const parentNpub = me?.npub ?? "";
    const res = await requestChildLink(parentNpub, childHex);
    if (!res.ok) {
      return json({ error: res.reason }, { status: 400 });
    }
    return json({ success: true });
  }

  if (action === "cancel_child_request") {
    const childHex = (formData.get("childNpub") as string) || "";
    if (!/^[0-9a-fA-F]{64}$/.test(childHex)) {
      return json({ error: "Invalid child hex pubkey" }, { status: 400 });
    }
    if (me?.isChild) {
      return json(
        { error: "Child accounts cannot manage child requests." },
        { status: 403 },
      );
    }
    const res = await cancelChildLinkRequest(me?.npub ?? "", childHex);
    if (!res.ok) {
      return json({ error: res.reason }, { status: 400 });
    }
    return json({ success: true });
  }

  if (action === "unlink_parent") {
    if (!me?.isChild) {
      return json(
        { error: "This account is not a child account." },
        { status: 400 },
      );
    }
    if (!me.npub) {
      return json({ error: "User npub not found" }, { status: 400 });
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

  if (action === "unlink_child") {
    const childNpub = (formData.get("childNpub") as string) || "";
    if (!/^[0-9a-fA-F]{64}$/.test(childNpub)) {
      return json({ error: "Invalid child hex pubkey" }, { status: 400 });
    }
    if (!me?.npub || me.isChild) {
      return json(
        { error: "Only a parent account can unlink a child." },
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

  return null;
}

/**
 * Handle subscription actions
 */
async function handleSubscriptionAction(
  userId: string,
  action: string,
  formData: FormData,
) {
  if (action === "switch_to_free_plan") {
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

  return null;
}

/**
 * Handle engagement/muted list actions
 */
async function handleEngagementAction(
  userId: string,
  action: string,
  formData: FormData,
) {
  if (action === "sync_muted_list") {
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

  if (action === "toggle_filter_muted") {
    const filterMuted = formData.get("filterMuted") === "true";
    await updateUserFilterMuted(userId, filterMuted);

    return json({ success: true, filterMuted });
  }

  if (action === "toggle_hide_low_trust") {
    const hidePostsFromLowTrustUsers = formData.get("hidePostsFromLowTrustUsers") === "true";
    await updateUserHideLowTrust(userId, hidePostsFromLowTrustUsers);

    return json({ success: true, hidePostsFromLowTrustUsers });
  }

  return null;
}

/**
 * Main settings action handler
 * Routes actions to appropriate handlers
 */
export async function handleSettingsAction(
  userId: string,
  formData: FormData,
) {
  const _action = formData.get("_action") as string;

  if (!_action) {
    return json({ error: "Action is required" }, { status: 400 });
  }

  // Try each handler category
  const handlers = [
    handleHashtagPresetAction,
    handleGeneralSettingsAction,
    handleQueueTypeAction,
    handleStorageSettingsAction,
    handleNWCAction,
    handleAccountsAction,
    handleSubscriptionAction,
    handleEngagementAction,
  ];

  for (const handler of handlers) {
    const result = await handler(userId, _action, formData);
    if (result) {
      return result;
    }
  }

  return json({ error: "Invalid action type" }, { status: 400 });
}

