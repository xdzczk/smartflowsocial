import { HelpCircle } from "lucide-react";

import { StatusIcon, type StatusTone } from "~/components/ui/status-icon";
import { cn } from "~/lib/utils";

/** Mirrors HealthStatus from admin-system-health without importing .server in client bundles. */
export type AdminHealthTone = "healthy" | "degraded" | "unknown" | "failing";

const toneStyles: Record<AdminHealthTone, string> = {
  healthy: "bg-success/15 text-success-text border-success/30",
  degraded: "bg-warning/15 text-warning-text border-warning/35",
  unknown: "bg-surface-hover text-text-secondary border-border",
  failing: "bg-danger/15 text-danger-text border-danger/35",
};

const HEALTH_TO_STATUS_TONE: Record<AdminHealthTone, StatusTone> = {
  healthy: "success",
  degraded: "warning",
  unknown: "neutral",
  failing: "danger",
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
  return (
    <div
      className={cn(
        "inline-flex max-w-xs flex-col gap-0.5 rounded-lg border px-2.5 py-1.5 text-xs",
        toneStyles[status],
        className
      )}
    >
      <span className="cluster-tight.5 font-medium">
        <StatusIcon
          tone={HEALTH_TO_STATUS_TONE[status]}
          size="sm"
          icon={status === "unknown" ? HelpCircle : undefined}
        />
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
  warning: "bg-warning/12 text-warning-text border-warning/35",
  danger: "bg-danger/12 text-danger-text border-danger/35",
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
