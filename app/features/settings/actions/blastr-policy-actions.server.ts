/**
 * Blastr policy settings actions: mode, enabled, add/remove relay.
 * Only for users with Blastr access (ACTIVE subscription + plan.enableRelayBlast).
 */

import { json } from "@remix-run/node";

import { getUserSubscription } from "~/features/payments/data";
import { getUserBasicInfo } from "~/features/user";
import {
  addPolicyRelay,
  putUserPolicy,
  removePolicyRelay,
  resolvePubkeyHex,
} from "~/infra/blastr/blastr-admin.client.server";

async function getBlastrEligiblePubkeyHex(
  userId: string
): Promise<string | null> {
  const [user, subscription] = await Promise.all([
    getUserBasicInfo(userId),
    getUserSubscription(userId),
  ]);
  if (
    !user?.npub ||
    subscription?.status !== "ACTIVE" ||
    !subscription.Plan?.enableRelayBlast
  )
    return null;
  return resolvePubkeyHex(user.npub);
}

const BLASTR_ACTIONS = [
  "update_blastr_policy",
  "add_blastr_policy_relay",
  "remove_blastr_policy_relay",
];

export async function handleBlastrPolicyAction(
  userId: string,
  action: string,
  formData: FormData
): Promise<ReturnType<typeof json> | null> {
  if (!BLASTR_ACTIONS.includes(action)) return null;

  const pubkeyHex = await getBlastrEligiblePubkeyHex(userId);
  if (!pubkeyHex) {
    return json({ error: "Blastr access required" }, { status: 403 });
  }

  if (action === "update_blastr_policy") {
    const mode = formData.get("mode");
    const enabledRaw = formData.get("enabled");
    const policyMode = mode === "whitelist" ? "whitelist" : "blacklist";
    const enabled = String(enabledRaw ?? "") === "true";
    const ok = await putUserPolicy(pubkeyHex, { mode: policyMode, enabled });
    if (!ok)
      return json({ error: "Failed to update Blastr policy" }, { status: 502 });
    return json({ success: true });
  }

  if (action === "add_blastr_policy_relay") {
    const relayUrl = formData.get("relay_url");
    const actionType = formData.get("action");
    if (typeof relayUrl !== "string" || !relayUrl.trim()) {
      return json({ error: "relay_url required" }, { status: 400 });
    }
    const allowOrBlock = actionType === "allow" ? "allow" : "block";
    const ok = await addPolicyRelay(pubkeyHex, relayUrl.trim(), allowOrBlock);
    if (!ok)
      return json(
        { error: "Failed to add relay to Blastr policy" },
        { status: 502 }
      );
    return json({ success: true });
  }

  if (action === "remove_blastr_policy_relay") {
    const relayUrl = formData.get("relay_url");
    if (typeof relayUrl !== "string" || !relayUrl.trim()) {
      return json({ error: "relay_url required" }, { status: 400 });
    }
    const ok = await removePolicyRelay(pubkeyHex, relayUrl.trim());
    if (!ok)
      return json(
        { error: "Failed to remove relay from Blastr policy" },
        { status: 502 }
      );
    return json({ success: true });
  }

  return null;
}
