import {
  getRelayStatusLabel,
  type RelayCheckStatus as RelayCheckStatusType,
  type RelayStatus,
} from "~/features/auth/login-flow.client";

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
}

/** Presentational list of relay connectivity status (checking | connected | failed). */
export function RelayCheckStatus({
  relayUrls,
  relayStatuses,
  title = "Relay status",
  children,
  className,
  maxRows,
}: RelayCheckStatusProps) {
  if (relayUrls.length === 0) return null;

  const capped =
    typeof maxRows === "number" ? relayUrls.slice(0, maxRows) : relayUrls;
  const hiddenCount =
    typeof maxRows === "number" ? Math.max(0, relayUrls.length - maxRows) : 0;

  return (
    <div
      className={
        className ??
        "border-border bg-muted/50 dark:bg-muted/30 space-y-2 rounded-md border p-3 pt-2 text-xs"
      }
    >
      <div className="text-foreground font-medium">{title}</div>
      <div className="grid gap-1.5">
        {capped.map((url) => {
          const s = relayStatuses[url];
          const status: RelayCheckStatusType = s?.status ?? "checking";
          const color =
            status === "connected"
              ? "text-success dark:text-success"
              : status === "failed"
                ? "text-destructive dark:text-destructive"
                : "text-muted-foreground";
          return (
            <div key={url} className="flex items-start justify-between gap-2">
              <div className="truncate font-mono text-xs">{url}</div>
              <div className={`shrink-0 font-medium ${color}`}>
                {getRelayStatusLabel(status)}
              </div>
            </div>
          );
        })}
      </div>
      {hiddenCount > 0 ? (
        <div className="text-muted-foreground text-[11px]">
          +{hiddenCount} more relay{hiddenCount === 1 ? "" : "s"} not shown
        </div>
      ) : null}
      {children ? (
        <div className="text-muted-foreground mt-3 text-xs">{children}</div>
      ) : null}
    </div>
  );
}
