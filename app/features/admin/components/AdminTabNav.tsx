import { NavLink, useLocation, useSearchParams } from "@remix-run/react";

import { cn } from "~/lib/utils";

import { useAdminCurrency } from "../admin-currency";
import { ADMIN_DISPLAY_UNITS } from "../format-admin-money";
import {
  defaultRangeForAdminPath,
  parseRangePreset,
  type RangePreset,
} from "../metrics/date-range";

const TABS = [
  { to: "/dashboard/admin", end: true, label: "Overview" },
  { to: "/dashboard/admin/analytics", end: false, label: "Analytics" },
  { to: "/dashboard/admin/users", end: false, label: "Users" },
  { to: "/dashboard/admin/operations", end: false, label: "Operations" },
  { to: "/dashboard/admin/referrals", end: false, label: "Referrals" },
] as const;

const RANGE_OPTIONS: RangePreset[] = ["24h", "7d", "30d", "90d", "all"];

export function AdminTabNav() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { unit, setUnit, spotFootnote, fx } = useAdminCurrency();
  const defaultR = defaultRangeForAdminPath(location.pathname);
  const range = parseRangePreset(searchParams.get("range"), defaultR);

  function setRange(next: RangePreset) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("range", next);
    setSearchParams(nextParams, { replace: true });
  }

  function hrefForTab(path: string): string {
    const p = new URLSearchParams(searchParams);
    p.delete("focus");
    p.set("range", range);
    const q = p.toString();
    return q ? `${path}?${q}` : path;
  }

  return (
    <div className="border-border from-background/95 to-background/75 sticky top-0 z-10 border-b bg-gradient-to-b backdrop-blur-md">
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex flex-wrap gap-1" aria-label="Admin sections">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={hrefForTab(tab.to)}
              end={tab.end}
              className={({ isActive }) =>
                cn(
                  "motion-fast rounded-md px-3 py-1.5 text-sm font-medium",
                  isActive
                    ? "bg-surface-hover text-text shadow-1"
                    : "text-text-secondary hover:text-text hover:bg-surface-hover/60"
                )
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-text-secondary text-xs">Range</span>
            <div className="flex flex-wrap gap-1">
              {RANGE_OPTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRange(r)}
                  className={cn(
                    "rounded-md px-2 py-1 text-xs font-medium",
                    range === r
                      ? "bg-brand text-brand-on"
                      : "bg-surface-hover text-text-secondary hover:bg-surface-hover/80"
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-text-secondary text-xs">Display</span>
            <div
              className="flex flex-wrap gap-1"
              role="group"
              aria-label="Money display unit"
            >
              {ADMIN_DISPLAY_UNITS.map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnit(u)}
                  className={cn(
                    "rounded-md px-2 py-1 text-xs font-medium",
                    unit === u
                      ? "bg-brand text-brand-on"
                      : "bg-surface-hover text-text-secondary hover:bg-surface-hover/80"
                  )}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
          {unit === "USD" || unit === "EUR" ? (
            <p className="text-text-secondary max-w-md text-right text-[11px] leading-snug">
              {fx.status === "loading" || fx.status === "idle"
                ? "Loading spot…"
                : spotFootnote}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
