import { NavLink, Outlet } from "@remix-run/react";

const subNav = [
  { to: "/dashboard/contests", end: true, label: "All contests" },
  { to: "/dashboard/contests/new", end: false, label: "New contest" },
  { to: "/dashboard/contests/presets", end: false, label: "Presets" },
  { to: "/dashboard/contests/proof", end: false, label: "Proof cards" },
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
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
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
