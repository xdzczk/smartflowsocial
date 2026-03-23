import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import { getSuppressionFlagsForPubkeys } from "~/features/broadcast";
import { withCSRFProtection } from "~/lib/csrf";

function parsePubkeysFromJson(body: unknown): string[] {
  if (body === null || typeof body !== "object") {
    return [];
  }
  const raw = (body as { pubkeys?: unknown }).pubkeys;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((p) => (typeof p === "string" ? p.toLowerCase().trim() : ""))
    .filter((p) => /^[0-9a-f]{64}$/i.test(p));
}

/**
 * POST JSON { pubkeys: string[] } — which lower-hex pubkeys are on suppression list.
 */
export const action = withCSRFProtection(
  async ({ request }: ActionFunctionArgs) => {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, { status: 405 });
    }
    const userId = await requireUserId(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, { status: 400 });
    }
    const normalized = parsePubkeysFromJson(body);
    if (normalized.length === 0) {
      const empty: Record<string, boolean> = {};
      return json({ suppressed: empty });
    }
    const suppressed = await getSuppressionFlagsForPubkeys(userId, normalized);
    return json({ suppressed });
  }
);
