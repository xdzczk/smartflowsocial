import { format } from "date-fns";
import {
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle,
  Info,
  XCircle,
} from "lucide-react";
import { useState, useMemo } from "react";

import { Button } from "~/components/ui/button";
import type { ConnectionLogEntry } from "~/features/auth/signer";

interface ConnectionHistoryProps {
  entries: ConnectionLogEntry[];
  limit?: number;
  showFilters?: boolean;
}

export function ConnectionHistory({
  entries,
  limit = 10,
  showFilters = false,
}: ConnectionHistoryProps) {
  const [expanded, setExpanded] = useState(false);
  const [filterType, setFilterType] = useState<
    ConnectionLogEntry["type"] | "all"
  >("all");

  const filteredEntries = useMemo(() => {
    let filtered = entries;
    if (filterType !== "all") {
      filtered = filtered.filter((e) => e.type === filterType);
    }
    return filtered;
  }, [entries, filterType]);

  const displayedEntries = expanded
    ? filteredEntries
    : filteredEntries.slice(0, limit);

  const getEntryIcon = (entry: ConnectionLogEntry) => {
    switch (entry.status) {
      case "success":
        return <CheckCircle className="text-success h-4 w-4" />;
      case "failure":
        return <XCircle className="text-destructive h-4 w-4" />;
      case "timeout":
        return <AlertCircle className="text-destructive h-4 w-4" />;
      default:
        return <Info className="text-muted-foreground h-4 w-4" />;
    }
  };

  const getEntryColor = (entry: ConnectionLogEntry): string => {
    switch (entry.status) {
      case "success":
        return "text-success";
      case "failure":
        return "text-destructive";
      case "timeout":
        return "text-destructive";
      default:
        return "text-muted-foreground";
    }
  };

  if (entries.length === 0) {
    return (
      <div className="text-muted-foreground rounded-md border p-4 text-center text-sm">
        No runtime events available
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {showFilters ? (
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filterType === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterType("all")}
          >
            All
          </Button>
          <Button
            variant={filterType === "connect" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterType("connect")}
          >
            Connect Events
          </Button>
          <Button
            variant={filterType === "error" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterType("error")}
          >
            Errors
          </Button>
          <Button
            variant={filterType === "health_check" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterType("health_check")}
          >
            Health Checks
          </Button>
          <Button
            variant={filterType === "sign" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterType("sign")}
          >
            Sign Events
          </Button>
        </div>
      ) : null}

      <div className="space-y-2">
        {displayedEntries.map((entry) => (
          <div
            key={entry.id}
            className="bg-muted/30 hover:bg-muted/50 flex min-w-0 items-start gap-3 rounded-md border p-3 transition-colors"
          >
            <div className="mt-0.5">{getEntryIcon(entry)}</div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span
                  className={`min-w-0 text-sm font-medium break-words ${getEntryColor(entry)}`}
                >
                  {entry.message}
                </span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {format(new Date(entry.timestamp), "MMM d, HH:mm:ss")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">
                  {entry.type}
                </span>
                {entry.details && Object.keys(entry.details).length > 0 ? (
                  <details className="text-muted-foreground text-xs">
                    <summary className="hover:text-foreground cursor-pointer">
                      Details
                    </summary>
                    <pre className="bg-background mt-1 rounded p-2 text-xs">
                      {JSON.stringify(entry.details, null, 2)}
                    </pre>
                  </details>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredEntries.length > limit ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="w-full"
        >
          {expanded ? (
            <>
              <ChevronUp className="mr-2 h-4 w-4" />
              Show Less
            </>
          ) : (
            <>
              <ChevronDown className="mr-2 h-4 w-4" />
              Show All ({filteredEntries.length} entries)
            </>
          )}
        </Button>
      ) : null}
    </div>
  );
}
