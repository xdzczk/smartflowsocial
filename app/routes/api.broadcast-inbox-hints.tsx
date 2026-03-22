import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { z } from "zod";

import { requireSession } from "~/features/auth";
import { withCSRFProtection } from "~/lib/csrf";
import { resolveCachedKind10050InboxRelays } from "~/lib/nostr.messenger.server";

const bodySchema = z.object({
  pubkeys: z.array(z.string().regex(/^[0-9a-fA-F]{64}$/)).max(500),
});

export const action = withCSRFProtection(
  async ({ request }: ActionFunctionArgs) => {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, { status: 405 });
    }

    await requireSession(request);

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return json({ error: "Invalid body" }, { status: 400 });
    }

    const hints: Record<string, string> = {};
    for (const pk of parsed.data.pubkeys) {
      const lower = pk.toLowerCase();
      if (!/^[0-9a-f]{64}$/.test(lower)) continue;
      const relays = await resolveCachedKind10050InboxRelays(lower);
      const first = relays[0]?.trim();
      if (first) hints[lower] = first;
    }

    return json({ hints });
  }
);
