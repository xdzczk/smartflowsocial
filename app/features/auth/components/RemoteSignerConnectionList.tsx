import { Search, Plus, X } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import type { RemoteSignerConnection } from "~/features/auth/signer";

import { SessionCard } from "./SessionCard";

interface RemoteSignerConnectionListProps {
  connections: RemoteSignerConnection[];
  activeConnection: RemoteSignerConnection | null;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onReconnect: (connectionId: string) => void;
  onSetActive: (connectionId: string) => void;
  onViewDetails: (connectionId: string) => void;
  onRemove: (connectionId: string) => void;
  onAddClick: () => void;
  /** When false, omit inline add button (use section header action). */
  showAddButton?: boolean;
}

export function RemoteSignerConnectionList({
  connections,
  activeConnection,
  searchQuery,
  onSearchChange,
  onReconnect,
  onSetActive,
  onViewDetails,
  onRemove,
  onAddClick,
  showAddButton = true,
}: RemoteSignerConnectionListProps) {
  const filteredConnections = connections.filter((conn) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      conn.label.toLowerCase().includes(query) ||
      (conn.metadata.signerAppName?.toLowerCase().includes(query) ?? false) ||
      (conn.metadata.pubkey?.toLowerCase().includes(query) ?? false)
    );
  });

  return (
    <div className="space-y-4">
      <div
        className={
          showAddButton
            ? "flex flex-col gap-2 sm:flex-row sm:items-center"
            : "flex flex-col gap-2"
        }
      >
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2" />
          <Input
            id="remote-signer-sessions-search"
            name="remote-signer-sessions-search"
            placeholder="Search connections..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8"
          />
          {searchQuery ? (
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-1/2 right-1 h-6 w-6 -translate-y-1/2"
              onClick={() => onSearchChange("")}
            >
              <X className="h-3 w-3" />
            </Button>
          ) : null}
        </div>
        {showAddButton ? (
          <Button onClick={onAddClick} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Add Connection
          </Button>
        ) : null}
      </div>

      {filteredConnections.length === 0 ? (
        <div className="text-muted-foreground rounded-md border p-8 text-center">
          {searchQuery
            ? "No connections match your search"
            : "No remote signer connections. Click 'Add Connection' to create one."}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredConnections.map((connection) => (
            <SessionCard
              key={connection.id}
              connection={connection}
              isActive={activeConnection?.id === connection.id}
              onReconnect={onReconnect}
              onSetActive={onSetActive}
              onViewDetails={onViewDetails}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
    </div>
  );
}
