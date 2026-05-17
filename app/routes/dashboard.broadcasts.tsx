import { NavLink, Outlet } from "@remix-run/react";

import { PageContent } from "~/components/layout/PageContent";
import {
  campaignSectionLayoutClassNames,
  campaignSectionSubNavClassNames,
} from "~/features/campaign-ui";

const subNav = [
  { to: "/dashboard/broadcasts", end: true, label: "All broadcasts" },
  { to: "/dashboard/broadcasts/new", end: false, label: "New broadcast" },
  { to: "/dashboard/broadcasts/audiences", end: false, label: "Audiences" },
  { to: "/dashboard/broadcasts/suppression", end: false, label: "Suppression" },
  { to: "/dashboard/broadcasts/settings", end: false, label: "Settings" },
] as const;

export default function BroadcastsLayout() {
  return (
    <PageContent fluid className={campaignSectionLayoutClassNames}>
      <nav
        aria-label="Broadcast sections"
        className={campaignSectionSubNavClassNames}
      >
        {subNav.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              [
                "focus-ring motion-fast rounded-md px-3 py-2 text-sm font-medium",
                isActive
                  ? "bg-selection-fill text-selection-foreground shadow-1 hover:bg-selection-fill/80"
                  : "text-text-secondary hover:bg-surface-hover hover:text-text",
              ].join(" ")
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </PageContent>
  );
}
