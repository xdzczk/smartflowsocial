import { NavLink, Outlet } from "@remix-run/react";

const subNav = [
  { to: "/dashboard/broadcasts", end: true, label: "All broadcasts" },
  { to: "/dashboard/broadcasts/new", end: false, label: "New broadcast" },
  { to: "/dashboard/broadcasts/audiences", end: false, label: "Audiences" },
  { to: "/dashboard/broadcasts/suppression", end: false, label: "Suppression" },
  { to: "/dashboard/broadcasts/settings", end: false, label: "Settings" },
] as const;

export default function BroadcastsLayout() {
  return (
    <div className="space-y-6">
      <nav
        aria-label="Broadcast sections"
        className="border-border flex flex-wrap gap-1 border-b pb-2"
      >
        {subNav.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              [
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
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
