import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import { fetchBroadcastRecipientProfiles } from "~/features/broadcast/broadcast-recipient-picker.server";
import { withCSRFProtection } from "~/lib/csrf";

function parsePubkeys(body: unknown): string[] {
  if (body === null || typeof body !== "object") return [];
  const raw = (body as { pubkeys?: unknown }).pubkeys;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p) => (typeof p === "string" ? p.toLowerCase().trim() : ""))
    .filter((p) => /^[0-9a-f]{64}$/i.test(p));
}

/**
 * POST JSON { pubkeys: string[] } — kind 0 display fields (batched, max ~500).
 */
export const action = withCSRFProtection(
  async ({ request }: ActionFunctionArgs) => {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, { status: 405 });
    }
    await requireUserId(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, { status: 400 });
    }
    const pubkeys = parsePubkeys(body);
    if (pubkeys.length === 0) {
      return json({ profiles: [] as const });
    }
    const capped = pubkeys.slice(0, 500);
    const profiles = await fetchBroadcastRecipientProfiles(capped);
    return json({ profiles });
  }
);
