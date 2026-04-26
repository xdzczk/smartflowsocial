import { NavLink, Outlet } from "@remix-run/react";

const subNav = [
  { to: "/dashboard/contests", end: true, label: "All contests" },
  { to: "/dashboard/contests/new", end: false, label: "New contest" },
  { to: "/dashboard/contests/presets", end: false, label: "Presets" },
  { to: "/dashboard/contests/proof", end: false, label: "Proof Studio" },
] as const;

export default function ContestsLayout() {
  return (
    <div className="space-y-6">
      <nav
        aria-label="Contest sections"
        className="border-border flex flex-wrap gap-1 border-b pb-2"
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
                  ? "bg-selection-fill text-selection-foreground shadow-1 hover:bg-selection-fill/90"
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
