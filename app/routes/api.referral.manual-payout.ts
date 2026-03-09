/**
 * Manual referral payout: pay one referrer via BOLT11 invoice.
 * Protected by REFERRAL_MANUAL_PAYOUT_SECRET (if set). For use by admin or cron/script.
 */

import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";

import { payReferrerWithInvoice } from "~/features/referral/referral-payout.server";
import { env } from "~/lib/env.server";

const SECRET_HEADER = "X-Referral-Payout-Secret";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const secret = env.REFERRAL_MANUAL_PAYOUT_SECRET;
  if (secret) {
    const provided = request.headers.get(SECRET_HEADER);
    if (provided !== secret) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  const o =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};
  const referrerNpub =
    typeof o["referrer_npub"] === "string" ? o["referrer_npub"].trim() : "";
  const bolt11 = typeof o["bolt11"] === "string" ? o["bolt11"].trim() : "";
  const amountSats =
    typeof o["amount_sats"] === "number" ? Math.floor(o["amount_sats"]) : NaN;

  if (
    !referrerNpub ||
    !bolt11 ||
    !Number.isFinite(amountSats) ||
    amountSats < 1
  ) {
    return json(
      { error: "Missing or invalid referrer_npub, bolt11, or amount_sats" },
      { status: 400 }
    );
  }

  const result = await payReferrerWithInvoice(referrerNpub, bolt11, amountSats);

  if (!result.success) {
    return json({ success: false, error: result.error }, { status: 422 });
  }

  return json({ success: true });
}
