/**
 * Internal subscription-status endpoint for Blossom server (vibe-cdn).
 * Blossom calls GET /internal/subscription-status?pubkey=<hex> with header
 * x-internal-secret to decide if a pubkey is allowed to upload (403 when inactive).
 * No session/cookies; server-to-server only.
 *
 * Access to our own Blossom server is gated by subscription: active is true only
 * when the user has an active subscription within the current billing period
 * (or lifetime access).
 */

import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import { isSubscriptionActiveForGating } from "~/features/payments";
import { getUserByNpub } from "~/features/user";
import { env } from "~/lib/env.server";
import { logInfo } from "~/lib/error-logger.server";
import { nostrAdapter } from "~/lib/nostr-adapter.server";

const BLOSSOM_INTERNAL_SECRET = env.BLOSSOM_INTERNAL_SECRET?.trim() ?? "";

export async function loader({ request }: LoaderFunctionArgs) {
  const secret = request.headers.get("x-internal-secret") ?? "";
  if (!BLOSSOM_INTERNAL_SECRET || secret !== BLOSSOM_INTERNAL_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const pubkeyParam =
    url.searchParams.get("pubkey") ?? request.headers.get("x-pubkey") ?? "";
  const pubkeyHex = pubkeyParam.trim().toLowerCase();
  if (!pubkeyHex || pubkeyHex.length < 32) {
    logInfo("Blossom subscription-status: invalid or missing pubkey", {
      pubkeyLength: pubkeyHex.length,
    });
    return json({ active: false });
  }

  // User.npub is stored as hex (from login flow), so look up by hex first; fallback to bech32 npub
  let user = await getUserByNpub(pubkeyHex);
  if (!user) {
    const npub = nostrAdapter.encodeNpub(pubkeyHex);
    if (npub) user = await getUserByNpub(npub);
  }
  if (!user) {
    logInfo("Blossom subscription-status: no user found for pubkey", {
      pubkeyLength: pubkeyHex.length,
    });
    return json({ active: false });
  }
  if (!user.isEnabled) {
    logInfo("Blossom subscription-status: user disabled", {
      userId: user.id,
      pubkeyLength: pubkeyHex.length,
    });
    return json({ active: false });
  }

  const active = await isSubscriptionActiveForGating(user.id);
  if (!active) {
    logInfo("Blossom subscription-status: subscription not active for gating", {
      userId: user.id,
      pubkeyLength: pubkeyHex.length,
    });
  }
  return json({ active });
}
