/**
 * NWC (Nostr Wallet Connect) action handlers
 */

import { json } from "@remix-run/node";

import {
  updateUserNWC,
  updateUserNWCEnabled,
  clearUserNWC,
} from "~/models/user.server";

export async function handleNWCAction(
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
