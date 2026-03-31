/**
 * Split handlers for engagement settings actions (keeps router complexity low).
 */

import { json } from "@remix-run/node";

import {
  createReplyTemplate,
  deleteReplyTemplate,
  updateReplyTemplate,
} from "~/features/engagement/engagement-reply-templates.server";
import { fetchMutedList } from "~/features/engagement/mutedList.server";
import {
  getUserBasicInfo,
  updateUserDefaultZapAmountSats,
  updateUserFilterMuted,
  updateUserHidePostsFromLowTrustUsers as updateUserHideLowTrust,
  updateUserMutedList,
} from "~/features/user";
import {
  toggleFilterMutedSchema,
  toggleHideLowTrustSchema,
  updateDefaultZapAmountSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";

export async function syncMutedListAction(userId: string) {
  const userInfo = await getUserBasicInfo(userId);

  if (!userInfo?.npub) {
    return json({ error: "User not found" }, { status: 404 });
  }

  const mutedListData = await fetchMutedList(userInfo.npub);

  if (!mutedListData) {
    return json(
      { error: "Failed to fetch muted list from Nostr" },
      { status: 500 }
    );
  }

  await updateUserMutedList(userId, mutedListData);

  return json({
    success: true,
    mutedList: mutedListData,
  });
}

export async function toggleFilterMutedAction(
  userId: string,
  formData: FormData
) {
  const result = validateFormDataOrRespond(formData, toggleFilterMutedSchema);
  if (!result.success) {
    return result.response;
  }
  await updateUserFilterMuted(userId, result.data.filterMuted);

  return json({ success: true, filterMuted: result.data.filterMuted });
}

export async function toggleHideLowTrustAction(
  userId: string,
  formData: FormData
) {
  const result = validateFormDataOrRespond(formData, toggleHideLowTrustSchema);
  if (!result.success) {
    return result.response;
  }
  await updateUserHideLowTrust(userId, result.data.hidePostsFromLowTrustUsers);

  return json({
    success: true,
    hidePostsFromLowTrustUsers: result.data.hidePostsFromLowTrustUsers,
  });
}

export async function replyTemplateCreateAction(
  userId: string,
  formData: FormData
) {
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
    return json({ error: result.error ?? "Failed to create" }, { status: 400 });
  }
  return json({ success: true });
}

export async function replyTemplateDeleteAction(
  userId: string,
  formData: FormData
) {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return json({ error: "Template id is required" }, { status: 400 });
  }
  const result = await deleteReplyTemplate(userId, id);
  if (!result.success) {
    return json({ error: result.error ?? "Failed to delete" }, { status: 400 });
  }
  return json({ success: true });
}

export async function replyTemplateUpdateAction(
  userId: string,
  formData: FormData
) {
  const id = formData.get("id");
  const slug = formData.get("slug");
  const body = formData.get("body");
  if (typeof id !== "string" || !id) {
    return json({ error: "Template id is required" }, { status: 400 });
  }
  if (typeof slug !== "string" || !slug.trim()) {
    return json({ error: "Slug is required" }, { status: 400 });
  }
  if (typeof body !== "string") {
    return json({ error: "Body is required" }, { status: 400 });
  }
  const result = await updateReplyTemplate(userId, id, slug.trim(), body);
  if (!result.success) {
    return json({ error: result.error ?? "Failed to update" }, { status: 400 });
  }
  return json({ success: true });
}

export async function updateDefaultZapAmountAction(
  userId: string,
  formData: FormData
) {
  const result = validateFormDataOrRespond(
    formData,
    updateDefaultZapAmountSchema
  );
  if (!result.success) {
    return result.response;
  }
  await updateUserDefaultZapAmountSats(
    userId,
    result.data.defaultZapAmountSats
  );
  return json({
    success: true,
    defaultZapAmountSats: result.data.defaultZapAmountSats,
  });
}
