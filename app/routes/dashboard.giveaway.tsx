import { NavLink, Outlet } from "@remix-run/react";

import { PageContent } from "~/components/layout/PageContent";
import {
  campaignSectionLayoutClassNames,
  campaignSectionSubNavClassNames,
} from "~/features/campaign-ui";

const subNav = [
  { to: "/dashboard/giveaway", end: true, label: "All giveaways" },
  { to: "/dashboard/giveaway/new", end: false, label: "New giveaway" },
  { to: "/dashboard/giveaway/presets", end: false, label: "Presets" },
  { to: "/dashboard/giveaway/proof", end: false, label: "Proof Studio" },
] as const;

/**
 * Layout for /dashboard/giveaway: child routes render in the outlet.
 */
export default function GiveawayLayout() {
  return (
    <PageContent fluid className={campaignSectionLayoutClassNames}>
      <nav
        aria-label="Giveaway sections"
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
