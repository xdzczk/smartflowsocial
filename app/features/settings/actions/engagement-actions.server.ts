/**
 * Engagement/muted list and reply templates action handlers
 */

import { json } from "@remix-run/node";

import {
  createReplyTemplate,
  deleteReplyTemplate,
} from "~/features/engagement/engagement-reply-templates.server";
import { fetchMutedList } from "~/features/engagement/mutedList.server";
import {
  getUserBasicInfo,
  updateUserFilterMuted,
  updateUserHidePostsFromLowTrustUsers as updateUserHideLowTrust,
  updateUserMutedList,
} from "~/features/user";
import {
  toggleFilterMutedSchema,
  toggleHideLowTrustSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";

export async function handleEngagementAction(
  userId: string,
  action: string,
  formData: FormData
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
        { status: 500 }
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
    const result = validateFormDataOrRespond(formData, toggleFilterMutedSchema);
    if (!result.success) {
      return result.response;
    }
    await updateUserFilterMuted(userId, result.data.filterMuted);

    return json({ success: true, filterMuted: result.data.filterMuted });
  }

  if (action === "toggle_hide_low_trust") {
    const result = validateFormDataOrRespond(
      formData,
      toggleHideLowTrustSchema
    );
    if (!result.success) {
      return result.response;
    }
    await updateUserHideLowTrust(
      userId,
      result.data.hidePostsFromLowTrustUsers
    );

    return json({
      success: true,
      hidePostsFromLowTrustUsers: result.data.hidePostsFromLowTrustUsers,
    });
  }

  if (action === "reply_template_create") {
    const slug = formData.get("slug");
    const body = formData.get("body");
    if (typeof slug !== "string" || !slug.trim()) {
      return json({ error: "Slug is required" }, { status: 400 });
    }
    if (typeof body !== "string") {
      return json({ error: "Body is required" }, { status: 400 });
    }
    const result = await createReplyTemplate(userId, slug.trim(), body);
    if (!result.success) {
      return json(
        { error: result.error ?? "Failed to create" },
        { status: 400 }
      );
    }
    return json({ success: true });
  }

  if (action === "reply_template_delete") {
    const id = formData.get("id");
    if (typeof id !== "string" || !id) {
      return json({ error: "Template id is required" }, { status: 400 });
    }
    const result = await deleteReplyTemplate(userId, id);
    if (!result.success) {
      return json(
        { error: result.error ?? "Failed to delete" },
        { status: 400 }
      );
    }
    return json({ success: true });
  }

  return null;
}
