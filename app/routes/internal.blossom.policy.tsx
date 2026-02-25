import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import {
  getSubscriptionData,
  isSubscriptionActiveForGating,
} from "~/features/payments";
import { getUserByNpub } from "~/features/user";
import { env } from "~/lib/env.server";
import { nostrAdapter } from "~/lib/nostr-adapter.server";

const BLOSSOM_INTERNAL_SECRET = env.BLOSSOM_INTERNAL_SECRET?.trim() ?? "";

function authorizeInternalRequest(request: Request): boolean {
  const provided = request.headers.get("x-internal-secret") ?? "";
  return BLOSSOM_INTERNAL_SECRET !== "" && BLOSSOM_INTERNAL_SECRET === provided;
}

export async function loader({ request }: LoaderFunctionArgs) {
  if (!authorizeInternalRequest(request)) {
    return json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const pubkeyParam =
    url.searchParams.get("pubkey") ?? request.headers.get("x-pubkey") ?? "";
  const pubkeyHex = pubkeyParam.trim().toLowerCase();

  if (!pubkeyHex || pubkeyHex.length < 32) {
    return json({
      active: false,
      planId: null,
      allowCompatUpload: false,
      reason: "invalid_pubkey",
    });
  }

  let user = await getUserByNpub(pubkeyHex);
  if (!user) {
    const npub = nostrAdapter.encodeNpub(pubkeyHex);
    if (npub) user = await getUserByNpub(npub);
  }
  if (!user?.isEnabled) {
    return json({
      active: false,
      planId: null,
      allowCompatUpload: false,
      reason: "user_missing_or_disabled",
    });
  }

  const [active, subscriptionData] = await Promise.all([
    isSubscriptionActiveForGating(user.id),
    getSubscriptionData(user.id),
  ]);

  const planId =
    subscriptionData.currentSubscription?.planId.toLowerCase() ?? "free";
  const isFreePlan = planId === "free";
  const allowCompatUpload = active && !isFreePlan;

  return json({
    active,
    planId,
    allowCompatUpload,
    reason: allowCompatUpload
      ? "allowed"
      : isFreePlan
        ? "free_plan"
        : "inactive",
  });
}
