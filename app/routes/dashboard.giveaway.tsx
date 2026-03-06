import { Outlet } from "@remix-run/react";

/**
 * Layout for /dashboard/giveaway so that child routes (e.g. /dashboard/giveaway/new)
 * render in the outlet. Without this, the "New giveaway" link would not show the new page.
 */
export default function GiveawayLayout() {
  return <Outlet />;
}
