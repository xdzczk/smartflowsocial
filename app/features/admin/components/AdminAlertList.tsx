import { Link } from "@remix-run/react";

import { cn } from "~/lib/utils";

import type {
  AdminAlertCategory,
  AdminAlertItem,
} from "../repositories/admin-overview-queries.server";

const CATEGORY_ORDER: AdminAlertCategory[] = [
  "business",
  "publishing",
  "signer",
  "infra",
  "payouts",
];

const CATEGORY_LABEL: Record<AdminAlertCategory, string> = {
  business: "Business",
  publishing: "Publishing",
  signer: "Signer",
  infra: "Infra",
  payouts: "Payouts",
};

function groupAlerts(
  alerts: AdminAlertItem[]
): Partial<Record<AdminAlertCategory, AdminAlertItem[]>> {
  const out: Partial<Record<AdminAlertCategory, AdminAlertItem[]>> = {};
  for (const a of alerts) {
    const list = out[a.category] ?? [];
    list.push(a);
    out[a.category] = list;
  }
  return out;
}

export function AdminAlertList({ alerts }: { alerts: AdminAlertItem[] }) {
  if (alerts.length === 0) {
    return (
      <div className="border-border bg-surface-hover/20 text-text-secondary rounded-lg border px-4 py-3 text-sm">
        No active issues detected for the current checks.
      </div>
    );
  }

  const grouped = groupAlerts(alerts);

  return (
    <div className="space-y-6">
      {CATEGORY_ORDER.map((cat) => {
        const items = grouped[cat];
        if (!items?.length) return null;
        return (
          <div key={cat}>
            <p className="text-text-secondary mb-2 text-[11px] font-semibold tracking-wide uppercase">
              {CATEGORY_LABEL[cat]}
            </p>
            <ul className="space-y-2">
              {items.map((a) => (
                <li key={a.id}>
                  <Link
                    to={a.href}
                    className={cn(
                      "hover:bg-surface-hover/50 motion-fast block rounded-lg border px-3 py-2 text-sm",
                      a.severity === "danger"
                        ? "border-danger/40 bg-danger/5"
                        : "border-warning/40 bg-warning/5"
                    )}
                  >
                    <span className="font-medium">{a.message}</span>
                    <span className="text-text-secondary ml-2 text-xs">
                      View →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
