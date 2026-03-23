import { json, type LoaderFunctionArgs } from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import { getMutualPubkeysGraph } from "~/features/nostr/social-graph.server";
import { getUserById } from "~/features/user";
import { nostrAdapter } from "~/lib/nostr-adapter.server";

/**
 * GET ?type=MUTUALS — estimated graph audience size (cache-based).
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  if (type !== "MUTUALS") {
    return json({ error: "Invalid type" }, { status: 400 });
  }

  const user = await getUserById(userId);
  if (!user?.npub) {
    return json({ count: null, fetchFailed: true });
  }
  const hex =
    nostrAdapter.decodeNpub(user.npub)?.toLowerCase() ??
    user.npub.toLowerCase();
  if (!/^[0-9a-f]{64}$/i.test(hex)) {
    return json({ count: null, fetchFailed: true });
  }

  const r = await getMutualPubkeysGraph(hex);

  return json({
    count: r.pubkeys.length,
    fetchFailed: r.fetchFailed,
  });
}
