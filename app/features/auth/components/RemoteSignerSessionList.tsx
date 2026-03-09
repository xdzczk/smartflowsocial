/**
 * Session/connection list and selection UI for reconnect flow.
 * Accepts sessions, selectedId, onSelect, loading, error and renders the list.
 */

import { cn } from "~/lib/utils";

export interface RemoteSignerSessionItem {
  id: string;
  label: string;
  /** Optional app name (e.g. "Primal") for display. */
  signerAppName?: string | null;
  /** Optional status for badge. */
  status?: string | null;
}

export interface RemoteSignerSessionListProps {
  sessions: RemoteSignerSessionItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading?: boolean;
  error?: string | null;
  className?: string;
  /** When true, show a single empty state instead of list. */
  emptyMessage?: string;
}

export function RemoteSignerSessionList({
  sessions,
  selectedId,
  onSelect,
  loading = false,
  error = null,
  className,
  emptyMessage = "No sessions to reconnect",
}: RemoteSignerSessionListProps) {
  if (error) {
    return (
      <div
        className={cn(
          "border-destructive bg-destructive/10 text-destructive rounded-md border p-3 text-sm",
          className
        )}
      >
        {error}
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className={cn(
          "text-muted-foreground rounded-md border border-dashed p-4 text-center text-sm",
          className
        )}
      >
        Loading sessions…
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div
        className={cn(
          "text-muted-foreground rounded-md border border-dashed p-4 text-center text-sm",
          className
        )}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <ul
      className={cn("space-y-1", className)}
      role="listbox"
      aria-label="Sessions"
    >
      {sessions.map((session) => {
        const isSelected = selectedId === session.id;
        return (
          <li key={session.id} role="option" aria-selected={isSelected}>
            <button
              type="button"
              onClick={() => onSelect(session.id)}
              className={cn(
                "hover:bg-muted/50 focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-transparent bg-transparent"
              )}
            >
              <span className="font-medium">{session.label}</span>
              {session.signerAppName ? (
                <span className="text-muted-foreground ml-2 text-xs">
                  {session.signerAppName}
                </span>
              ) : null}
              {session.status ? (
                <span className="text-muted-foreground ml-2 text-xs">
                  {session.status}
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
