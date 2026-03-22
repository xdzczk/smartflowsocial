import { Outlet } from "@remix-run/react";

import { AdminCurrencyProvider, AdminTabNav } from "~/features/admin";

/**
 * Operator admin layout: tabbed navigation + shared range control.
 */
export default function DashboardAdminLayout() {
  return (
    <AdminCurrencyProvider>
      <div className="admin-surface from-muted/25 to-background min-h-[60vh] bg-gradient-to-b pb-12">
        <AdminTabNav />
        <Outlet />
      </div>
    </AdminCurrencyProvider>
  );
}
