/**
 * Accounts management action handlers
 */

import { json } from "@remix-run/node";
import { updateUserSubscription, getUserSubscription } from "~/models/payment.server";
import {
  getUserBasicInfo,
  searchUsersByProfileName,
  requestChildLink,
  cancelChildLinkRequest,
  unlinkParent,
  unlinkChildByParent,
  getUserIdByNpub,
} from "~/models/user.server";

export async function handleAccountsAction(
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

