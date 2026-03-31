/**
 * Accounts management action handlers
 */

import { json } from "@remix-run/node";

import {
  updateUserSubscription,
  getUserSubscription,
} from "~/features/payments/data";
import {
  getUserBasicInfo,
  searchUsersByProfileName,
  requestChildLink,
  cancelChildLinkRequest,
  unlinkParent,
  unlinkChildByParent,
  getUserIdByNpub,
} from "~/features/user";
import { logWarning } from "~/lib/error-logger.server";
import {
  searchAccountsSchema,
  requestChildSchema,
  cancelChildRequestSchema,
  unlinkChildSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";

// ============================================================================
// Action Handlers
// ============================================================================

async function handleSearchAccounts(
  formData: FormData,
  me: Awaited<ReturnType<typeof getUserBasicInfo>>
): Promise<Response> {
  const result = validateFormDataOrRespond(formData, searchAccountsSchema);
  if (!result.success) {
    return result.response;
  }
  if (me?.isChild) {
    return json(
      { error: "Child accounts cannot search or manage child accounts." },
      { status: 403 }
    );
  }
  const results = await searchUsersByProfileName(
    result.data.q,
    me?.npub ?? undefined
  );
  return json({ results });
}

async function handleRequestChild(
  formData: FormData,
  me: Awaited<ReturnType<typeof getUserBasicInfo>>
): Promise<Response> {
  const result = validateFormDataOrRespond(formData, requestChildSchema);
  if (!result.success) {
    return result.response;
  }
  if (me?.isChild) {
    return json(
      { error: "Child accounts cannot link child accounts." },
      { status: 403 }
    );
  }
  const parentNpub = me?.npub ?? "";
  const res = await requestChildLink(parentNpub, result.data.childNpub);
  if (!res.ok) {
    return json({ error: res.reason }, { status: 400 });
  }
  return json({ success: true });
}

async function handleCancelChildRequest(
  formData: FormData,
  me: Awaited<ReturnType<typeof getUserBasicInfo>>
): Promise<Response> {
  const result = validateFormDataOrRespond(formData, cancelChildRequestSchema);
  if (!result.success) {
    return result.response;
  }
  if (me?.isChild) {
    return json(
      { error: "Child accounts cannot manage child requests." },
      { status: 403 }
    );
  }
  const res = await cancelChildLinkRequest(
    me?.npub ?? "",
    result.data.childNpub
  );
  if (!res.ok) {
    return json({ error: res.reason }, { status: 400 });
  }
  return json({ success: true });
}

async function handleUnlinkParent(
  userId: string,
  me: Awaited<ReturnType<typeof getUserBasicInfo>>
): Promise<Response> {
  if (!me?.isChild) {
    return json(
      { error: "This account is not a child account." },
      { status: 400 }
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
      `free_child_unlink_${Date.now()}_${userId}`
    );
  } catch (e) {
    logWarning("Failed to demote child to free after unlink", {
      userId,
      error: e instanceof Error ? e.message : String(e),
    });
  }
  return json({ success: true });
}

async function handleUnlinkChild(
  formData: FormData,
  me: Awaited<ReturnType<typeof getUserBasicInfo>>
): Promise<Response> {
  const result = validateFormDataOrRespond(formData, unlinkChildSchema);
  if (!result.success) {
    return result.response;
  }
  if (!me?.npub || me.isChild) {
    return json(
      { error: "Only a parent account can unlink a child." },
      { status: 403 }
    );
  }
  const res = await unlinkChildByParent(me.npub, result.data.childNpub);
  if (!res.ok) {
    return json({ error: res.reason }, { status: 400 });
  }
  // Demote child to free plan
  try {
    const childId = await getUserIdByNpub(result.data.childNpub);
    if (childId) {
      await updateUserSubscription(
        childId,
        "free",
        `free_child_unlink_${Date.now()}_${childId}`
      );
    }
  } catch (e) {
    logWarning("Failed to demote unlinked child to free", {
      childNpub: result.data.childNpub,
      error: e instanceof Error ? e.message : String(e),
    });
  }
  return json({ success: true });
}

export async function handleAccountsAction(
  userId: string,
  action: string,
  formData: FormData
) {
  const me = await getUserBasicInfo(userId);
  const sub = await getUserSubscription(userId);
  const planName = sub?.Plan?.name ?? "";
  const planId = (sub?.planId ?? "").toLowerCase();

  // Check access for account management actions
  const requiresPremium = [
    "search_accounts",
    "request_child",
    "cancel_child_request",
    "unlink_child",
  ].includes(action);
  if (
    requiresPremium &&
    !(
      planId === "premium" ||
      planName === "Founder" ||
      planName === "Premium" ||
      planName === "Pro"
    )
  ) {
    return json(
      {
        error: "Accounts management requires Founder or Pro. Please upgrade.",
      },
      { status: 403 }
    );
  }

  if (action === "search_accounts") {
    return handleSearchAccounts(formData, me);
  }

  if (action === "request_child") {
    return handleRequestChild(formData, me);
  }

  if (action === "cancel_child_request") {
    return handleCancelChildRequest(formData, me);
  }

  if (action === "unlink_parent") {
    return handleUnlinkParent(userId, me);
  }

  if (action === "unlink_child") {
    return handleUnlinkChild(formData, me);
  }

  return null;
}
