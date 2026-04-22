import { Badge } from "~/components/ui/badge";
import {
  getRelayStatusLabel,
  getRelayStatusUserLabel,
  type RelayCheckStatus as RelayCheckStatusType,
  type RelayStatus,
} from "~/features/auth/login-flow.client";
import { cn } from "~/lib/utils";

export type RelayCheckPresentation = "legacy" | "product";

export interface RelayCheckStatusProps {
  /** Ordered list of relay URLs to display */
  relayUrls: string[];
  /** Status per URL (key = relay url) */
  relayStatuses: Record<string, RelayStatus>;
  /** Optional header text */
  title?: string;
  /** Optional footer/helper text (e.g. "If any relays fail...") */
  children?: React.ReactNode;
  className?: string;
  /** Cap rows shown (remaining relays are omitted from the list) */
  maxRows?: number;
  /** Product: chips + calmer labels; legacy: plain text status column */
  presentation?: RelayCheckPresentation;
}

function statusBadgeClass(status: RelayCheckStatusType): string {
  switch (status) {
    case "connected":
      return "border-success/35 bg-success/10 text-success dark:text-success";
    case "failed":
      return "border-danger/35 bg-danger/10 text-danger";
    default:
      return "text-text-secondary border-border/80 bg-surface-hover/50";
  }
}

/** Presentational list of relay connectivity status (checking | connected | failed). */
export function RelayCheckStatus({
  relayUrls,
  relayStatuses,
  title = "Relay status",
  children,
  className,
  maxRows,
  presentation = "product",
}: RelayCheckStatusProps) {
  if (relayUrls.length === 0) return null;

  const capped =
    typeof maxRows === "number" ? relayUrls.slice(0, maxRows) : relayUrls;
  const hiddenCount =
    typeof maxRows === "number" ? Math.max(0, relayUrls.length - maxRows) : 0;

  const defaultShell =
    presentation === "product"
      ? "bg-surface-hover/30 dark:bg-surface-hover/20 space-y-2.5 rounded-lg p-3 text-xs"
      : "border-border bg-surface-hover/50 dark:bg-surface-hover/30 space-y-2 rounded-md border p-3 pt-2 text-xs";

  return (
    <div className={cn(defaultShell, className)}>
      <div
        className={cn(
          "text-text font-medium",
          presentation === "product" && "text-sm"
        )}
      >
        {title}
      </div>
      <div className="grid gap-2">
        {capped.map((url) => {
          const s = relayStatuses[url];
          const status: RelayCheckStatusType = s?.status ?? "checking";
          const label =
            presentation === "product"
              ? getRelayStatusUserLabel(status)
              : getRelayStatusLabel(status);

          if (presentation === "product") {
            return (
              <div
                key={url}
                className="flex items-center justify-between gap-3 rounded-md py-0.5"
              >
                <div className="min-w-0 truncate font-mono text-[11px] leading-tight">
                  {url}
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "shrink-0 font-medium",
                    statusBadgeClass(status)
                  )}
                >
                  {label}
                </Badge>
              </div>
            );
          }

          const color =
            status === "connected"
              ? "text-success dark:text-success"
              : status === "failed"
                ? "text-danger dark:text-danger"
                : "text-text-secondary";
          return (
            <div key={url} className="flex items-start justify-between gap-2">
              <div className="truncate font-mono text-xs">{url}</div>
              <div className={cn("shrink-0 font-medium", color)}>{label}</div>
            </div>
          );
        })}
      </div>
      {hiddenCount > 0 ? (
        <div className="text-text-secondary text-[11px]">
          +{hiddenCount} more relay{hiddenCount === 1 ? "" : "s"} not shown
        </div>
      ) : null}
      {children ? (
        <div className="text-text-secondary mt-1 text-xs">{children}</div>
      ) : null}
    </div>
  );
}
