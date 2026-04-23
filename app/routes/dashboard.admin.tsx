import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Outlet, useLoaderData } from "@remix-run/react";

import { AdminCurrencyProvider, AdminTabNav } from "~/features/admin";
import { getAdminBtcSpotRates } from "~/features/admin/admin-fx-rates.server";
import { requireUser } from "~/features/auth";
import { isReferralAdmin } from "~/features/referral/referral-admin.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  if (!isReferralAdmin(user.npub)) {
    return json({ adminFx: null, adminFxError: false as const });
  }
  try {
    const rates = await getAdminBtcSpotRates();
    return json({ adminFx: rates, adminFxError: false as const });
  } catch {
    return json({ adminFx: null, adminFxError: true as const });
  }
}

/**
 * Operator admin layout: tabbed navigation + shared range control.
 * FX rates load with this layout (server) so USD/EUR do not depend on a separate client fetch.
 */
export default function DashboardAdminLayout() {
  const { adminFx, adminFxError } = useLoaderData<typeof loader>();

  return (
    <AdminCurrencyProvider initialFx={adminFx} initialFxError={adminFxError}>
      <div className="from-surface-hover/25 to-canvas min-h-[60vh] bg-gradient-to-b pb-12">
        <AdminTabNav />
        <Outlet />
      </div>
    </AdminCurrencyProvider>
  );
}
