import { json, type LoaderFunctionArgs } from "@remix-run/node";

import { getAdminBtcSpotRates } from "~/features/admin/admin-fx-rates.server";
import { requireUser } from "~/features/auth";
import { isReferralAdmin } from "~/features/referral/referral-admin.server";

/**
 * GET /api/admin/fx-rates  -  Kraken XBTUSDC + XBTEUR last trade (referral admins only).
 */
export async function loader({ request }: LoaderFunctionArgs) {
  if (request.method !== "GET") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }
  const user = await requireUser(request);
  if (!isReferralAdmin(user.npub)) {
    return json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const rates = await getAdminBtcSpotRates();
    return json(rates);
  } catch {
    return json({ error: "rates_unavailable" }, { status: 503 });
  }
}

export default function AdminFxRatesResource() {
  return null;
}
