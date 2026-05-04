import { json, type LoaderFunctionArgs } from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import { getBroadcastEligiblePoolPubkeys } from "~/features/broadcast/broadcast-recipient-picker.server";

/**
 * GET ?pool=followers|mutuals  -  eligible pubkey list for recipient picker (cache-based).
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const url = new URL(request.url);
  const pool = url.searchParams.get("pool");
  if (pool !== "followers" && pool !== "mutuals") {
    return json({ error: "Invalid pool" }, { status: 400 });
  }

  const { pubkeys, fetchFailed } = await getBroadcastEligiblePoolPubkeys(
    userId,
    pool
  );

  return json({
    pubkeys,
    fetchFailed,
    truncatedNote:
      pool === "followers" && pubkeys.length >= 1000
        ? "Follower list may be capped by the cache (up to 1000)."
        : null,
  });
}
