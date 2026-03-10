import { json } from "@remix-run/node";

import type { PrimarySignerProfile } from "~/features/auth/signer";
import {
  clearUserPrimarySignerProfile,
  updateUserPrimarySignerProfile,
} from "~/features/user";
import {
  updatePrimarySignerProfileSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";

export async function handleSignerSettingsAction(
  userId: string,
  action: string,
  formData: FormData
) {
  if (action === "update_primary_signer_profile") {
    const result = validateFormDataOrRespond(
      formData,
      updatePrimarySignerProfileSchema
    );
    if (!result.success) {
      return result.response;
    }

    const nowIso = new Date().toISOString();
    const profile: PrimarySignerProfile =
      result.data.method === "bunker_input"
        ? {
            type: "nip46",
            method: "bunker_input",
            bunkerInput: result.data.bunkerInput,
            label: result.data.label,
            expectedPubkey: result.data.expectedPubkey,
            updatedAt: nowIso,
          }
        : {
            type: "nip46",
            method: "nostrconnect_uri",
            uri: result.data.uri,
            relays: result.data.relays,
            label: result.data.label,
            expectedPubkey: result.data.expectedPubkey,
            updatedAt: nowIso,
          };

    await updateUserPrimarySignerProfile(userId, profile);
    return json({ success: true, primarySignerProfile: profile });
  }

  if (action === "clear_primary_signer_profile") {
    await clearUserPrimarySignerProfile(userId);
    return json({ success: true, primarySignerProfile: null });
  }

  return null;
}
