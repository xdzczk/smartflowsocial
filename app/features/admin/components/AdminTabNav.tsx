import { NavLink, useLocation, useSearchParams } from "@remix-run/react";

import { SegmentedControl } from "~/components/ui/segmented-control";
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

const RANGE_SEGMENT_OPTIONS = RANGE_OPTIONS.map((r) => ({
  value: r,
  label: r,
}));

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
    <div className="border-border bg-canvas sticky top-0 z-10 border-b">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4 sm:px-6 sm:pb-4">
        <nav className="flex flex-wrap gap-1" aria-label="Admin sections">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={hrefForTab(tab.to)}
              end={tab.end}
              className={({ isActive }) =>
                cn(
                  "focus-ring motion-fast rounded-md px-3 py-1.5 text-sm font-medium",
                  isActive
                    ? "bg-selection-fill text-selection-foreground shadow-1 hover:bg-selection-fill/90"
                    : "text-text-secondary hover:bg-surface-hover/60 hover:text-text"
                )
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex min-w-0 flex-col items-stretch gap-2 sm:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-text-secondary shrink-0 text-xs">Range</span>
            <SegmentedControl
              aria-label="Date range"
              value={range}
              onChange={(next) => setRange(next as RangePreset)}
              options={RANGE_SEGMENT_OPTIONS}
              size="compact"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-text-secondary shrink-0 text-xs">
              Display
            </span>
            <SegmentedControl
              aria-label="Money display unit"
              value={unit}
              onChange={(next) =>
                setUnit(next as (typeof ADMIN_DISPLAY_UNITS)[number])
              }
              options={ADMIN_DISPLAY_UNITS.map((u) => ({ value: u, label: u }))}
              size="compact"
            />
          </div>
          {unit === "USD" || unit === "EUR" ? (
            <p className="text-text-secondary max-w-md self-end text-right text-[11px] leading-snug">
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
