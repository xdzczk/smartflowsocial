import { SignerReconnectFailureBucket } from "@prisma/client";
import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";

import { insertSignerReconnectEvent } from "~/features/admin/repositories/admin-telemetry.server";
import { requireUserId } from "~/features/auth";
import { withCSRFProtection } from "~/lib/csrf";

function parseFailureBucket(
  v: unknown
): SignerReconnectFailureBucket | undefined {
  if (v === "TIMEOUT") return SignerReconnectFailureBucket.TIMEOUT;
  if (v === "NETWORK") return SignerReconnectFailureBucket.NETWORK;
  if (v === "SESSION_DROPPED")
    return SignerReconnectFailureBucket.SESSION_DROPPED;
  if (v === "UNKNOWN") return SignerReconnectFailureBucket.UNKNOWN;
  return undefined;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/**
 * POST /api/signer-reconnect  -  NIP-46 background reconnect outcome (narrow telemetry).
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
    if (!isRecord(body)) {
      return json({ error: "Invalid body" }, { status: 400 });
    }
    const success = body["success"];
    if (typeof success !== "boolean") {
      return json({ error: "success must be boolean" }, { status: 400 });
    }
    const failureBucket = parseFailureBucket(body["failureBucket"]);
    const result = await insertSignerReconnectEvent({
      userId,
      success,
      failureBucket: success ? null : failureBucket,
    });
    if (!result.ok) {
      return json({ error: "rate_limited" }, { status: 429 });
    }
    return json({ ok: true });
  }
);

export default function SignerReconnectApi() {
  return null;
}
