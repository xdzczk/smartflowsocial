import { AlertTriangle, CheckCircle2, HelpCircle, XCircle } from "lucide-react";

import { cn } from "~/lib/utils";

/** Mirrors HealthStatus from admin-system-health without importing .server in client bundles. */
export type AdminHealthTone = "healthy" | "degraded" | "unknown" | "failing";

const toneStyles: Record<AdminHealthTone, string> = {
  healthy:
    "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/30",
  degraded:
    "bg-amber-500/15 text-amber-900 dark:text-amber-100 border-amber-500/35",
  unknown: "bg-muted text-muted-foreground border-border",
  failing: "bg-red-500/15 text-red-800 dark:text-red-200 border-red-500/35",
};

const icons: Record<AdminHealthTone, typeof CheckCircle2> = {
  healthy: CheckCircle2,
  degraded: AlertTriangle,
  unknown: HelpCircle,
  failing: XCircle,
};

export function AdminStatusPill({
  label,
  status,
  detail,
  className,
}: {
  label: string;
  status: AdminHealthTone;
  detail?: string;
  className?: string;
}) {
  const Icon = icons[status];
  return (
    <div
      className={cn(
        "inline-flex max-w-xs flex-col gap-0.5 rounded-lg border px-2.5 py-1.5 text-xs",
        toneStyles[status],
        className
      )}
    >
      <span className="flex items-center gap-1.5 font-medium">
        <Icon className="size-3.5 shrink-0 opacity-90" aria-hidden />
        {label}
        <span className="font-normal opacity-90">{status}</span>
      </span>
      {detail ? (
        <span className="text-[11px] leading-snug opacity-90">{detail}</span>
      ) : null}
    </div>
  );
}

export type AlertSeverity = "warning" | "danger";

const alertStyles: Record<AlertSeverity, string> = {
  warning:
    "bg-amber-500/12 text-amber-950 dark:text-amber-50 border-amber-500/35",
  danger: "bg-red-500/12 text-red-950 dark:text-red-50 border-red-500/35",
};

export function AdminAlertSeverityPill({
  severity,
  className,
}: {
  severity: AlertSeverity;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
        alertStyles[severity],
        className
      )}
    >
      {severity === "danger" ? "Critical" : "Warning"}
    </span>
  );
}
