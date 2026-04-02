import { json, type LoaderFunctionArgs } from "@remix-run/node";

import {
  fetchPrimalProfileData,
  LOGIN_FLOW_PRIMAL_FETCH_BUDGET_MS,
  processPrimalData,
} from "~/features/auth/profile.server";
import { nostrAdapter } from "~/lib/nostr-adapter.server";

/**
 * GET /api/profile-display-name?pubkey=<hex|npub>
 * Returns display name for a Nostr pubkey (used on login panel: "Signing in as username").
 * No auth required.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("pubkey")?.trim();
  if (!raw) {
    return json({ displayName: null });
  }

  const npub =
    raw.length === 64 && /^[0-9a-fA-F]+$/.test(raw)
      ? nostrAdapter.encodeNpub(raw)
      : raw.startsWith("npub")
        ? raw
        : null;
  if (!npub) {
    return json({ displayName: null });
  }

  try {
    const primalData = await fetchPrimalProfileData(npub, {
      primalFetchBudgetMs: LOGIN_FLOW_PRIMAL_FETCH_BUDGET_MS,
    });
    const { profile } = processPrimalData(primalData);
    const d =
      typeof profile.display_name === "string"
        ? profile.display_name.trim()
        : "";
    const n = typeof profile.name === "string" ? profile.name.trim() : "";
    const displayName = d || n || null;
    return json({ displayName });
  } catch {
    return json({ displayName: null });
  }
}
