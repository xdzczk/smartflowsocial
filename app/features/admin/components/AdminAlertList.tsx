import { Link } from "@remix-run/react";

import { cn } from "~/lib/utils";

import type { AdminAlertItem } from "../repositories/admin-overview-queries.server";

export function AdminAlertList({ alerts }: { alerts: AdminAlertItem[] }) {
  if (alerts.length === 0) {
    return (
      <div className="border-border bg-muted/20 text-muted-foreground rounded-lg border px-4 py-3 text-sm">
        No active issues detected for the current checks.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {alerts.map((a) => (
        <li key={a.id}>
          <Link
            to={a.href}
            className={cn(
              "hover:bg-muted/50 block rounded-lg border px-3 py-2 text-sm transition-colors",
              a.severity === "danger"
                ? "border-red-500/40 bg-red-500/5"
                : "border-amber-500/40 bg-amber-500/5"
            )}
          >
            <span className="font-medium">{a.message}</span>
            <span className="text-muted-foreground ml-2 text-xs">View →</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
