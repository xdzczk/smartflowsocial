import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import { requireSession } from "~/features/auth";
import {
  BroadcastActionError,
  finalizeBroadcastCampaign,
} from "~/features/broadcast/broadcast-actions.server";
import { finalizeBroadcastSchema } from "~/features/broadcast/broadcast-types";
import { withCSRFProtection } from "~/lib/csrf";

export const action = withCSRFProtection(
  async ({ request }: ActionFunctionArgs) => {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, { status: 405 });
    }

    const session = await requireSession(request);

    let bodyRaw: unknown;
    try {
      bodyRaw = await request.json();
    } catch {
      return json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = finalizeBroadcastSchema.safeParse(bodyRaw);
    if (!parsed.success) {
      return json(
        {
          error: "Validation failed",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    try {
      const result = await finalizeBroadcastCampaign(
        session.userId,
        session.pubkey,
        parsed.data
      );
      return json({ success: true as const, ...result });
    } catch (error) {
      if (error instanceof BroadcastActionError) {
        return json(
          { error: error.message, code: error.code },
          { status: 400 }
        );
      }
      throw error;
    }
  }
);
