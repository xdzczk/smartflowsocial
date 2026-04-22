import { NavLink, Outlet } from "@remix-run/react";

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
    <div className="space-y-6">
      <nav
        aria-label="Giveaway sections"
        className="border-border flex flex-wrap gap-1 border-b pb-2"
      >
        {subNav.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              [
                "motion-fast rounded-md px-3 py-2 text-sm font-medium",
                isActive
                  ? "bg-brand/10 text-brand"
                  : "text-text-secondary hover:bg-surface-hover hover:text-text",
              ].join(" ")
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
