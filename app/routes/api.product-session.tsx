import { ProductSessionDeviceCoarse } from "@prisma/client";
import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";

import {
  endProductSession,
  touchProductSessionHeartbeat,
  upsertProductSessionStart,
} from "~/features/admin/repositories/admin-telemetry.server";
import { requireUserId } from "~/features/auth";
import { withCSRFProtection } from "~/lib/csrf";

function parseDeviceCoarse(v: unknown): ProductSessionDeviceCoarse | undefined {
  if (v === "mobile") return ProductSessionDeviceCoarse.mobile;
  if (v === "desktop") return ProductSessionDeviceCoarse.desktop;
  if (v === "tablet") return ProductSessionDeviceCoarse.tablet;
  if (v === "unknown") return ProductSessionDeviceCoarse.unknown;
  return undefined;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/**
 * POST /api/product-session — start | heartbeat | end for dashboard product usage.
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
    const phase = body["phase"];
    const clientSessionId = body["clientSessionId"];
    if (phase !== "start" && phase !== "heartbeat" && phase !== "end") {
      return json({ error: "Invalid phase" }, { status: 400 });
    }
    if (typeof clientSessionId !== "string" || clientSessionId.length < 8) {
      return json({ error: "Invalid clientSessionId" }, { status: 400 });
    }
    if (clientSessionId.length > 128) {
      return json({ error: "clientSessionId too long" }, { status: 400 });
    }

    const deviceCoarse = parseDeviceCoarse(body["deviceCoarse"]);

    if (phase === "start") {
      await upsertProductSessionStart({
        userId,
        clientSessionId,
        deviceCoarse,
      });
      return json({ ok: true });
    }
    if (phase === "heartbeat") {
      const r = await touchProductSessionHeartbeat({ userId, clientSessionId });
      return json({ ok: r.ok, throttled: r.reason === "throttled" });
    }
    await endProductSession({ userId, clientSessionId });
    return json({ ok: true });
  }
);

export default function ProductSessionApi() {
  return null;
}
