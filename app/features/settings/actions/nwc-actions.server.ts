/**
 * NWC (Nostr Wallet Connect) action handlers
 */

import { json } from "@remix-run/node";

import {
  updateNWCSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";
import {
  updateUserNWC,
  updateUserNWCEnabled,
  clearUserNWC,
} from "~/features/user";

export async function handleNWCAction(
  userId: string,
  action: string,
  formData: FormData,
) {
  if (action === "update_nwc") {
    const result = validateFormDataOrRespond(formData, updateNWCSchema);
    if (!result.success) {
      return result.response;
    }

    if (result.data.nwcEnabled && result.data.nwcString?.trim()) {
      // Update with new NWC string
      await updateUserNWC(userId, result.data.nwcString.trim(), true);
    } else {
      // Just update enabled status
      await updateUserNWCEnabled(userId, result.data.nwcEnabled);
    }
    return json({ success: true });
  }

  if (action === "clear_nwc") {
    await clearUserNWC(userId);
    return json({ success: true });
  }

  return null;
}

