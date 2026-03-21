import { Outlet } from "@remix-run/react";

import { AdminTabNav } from "~/features/admin";

/**
 * Operator admin layout: tabbed navigation + shared range control.
 */
export default function DashboardAdminLayout() {
  return (
    <div className="min-h-[60vh] pb-12">
      <AdminTabNav />
      <Outlet />
    </div>
  );
}
