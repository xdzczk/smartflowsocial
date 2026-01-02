/**
 * Engagement/muted list action handlers
 */

import { json } from "@remix-run/node";

import { fetchMutedList } from "~/features/engagement/mutedList.server";
import {
  getUserBasicInfo,
  updateUserFilterMuted,
  updateUserHidePostsFromLowTrustUsers as updateUserHideLowTrust,
  updateUserMutedList,
} from "~/models/user.server";

export async function handleEngagementAction(
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
    const hidePostsFromLowTrustUsers =
      formData.get("hidePostsFromLowTrustUsers") === "true";
    await updateUserHideLowTrust(userId, hidePostsFromLowTrustUsers);

    return json({ success: true, hidePostsFromLowTrustUsers });
  }

  return null;
}
