import { Search, Plus, X } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import type {
  PrimarySignerProfile,
  RemoteSignerConnection,
} from "~/features/auth/signer";
import { convertToHex } from "~/lib/nostr-conversion";

import { SessionCard } from "./SessionCard";

interface RemoteSignerConnectionListProps {
  connections: RemoteSignerConnection[];
  activeConnection: RemoteSignerConnection | null;
  primarySignerProfile: PrimarySignerProfile | null;
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

const SHOW_SEARCH_MIN_CONNECTIONS = 4;

export function RemoteSignerConnectionList({
  connections,
  activeConnection,
  primarySignerProfile,
  searchQuery,
  onSearchChange,
  onReconnect,
  onSetActive,
  onViewDetails,
  onRemove,
  onAddClick,
  showAddButton = true,
}: RemoteSignerConnectionListProps) {
  const showSearch = connections.length >= SHOW_SEARCH_MIN_CONNECTIONS;

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
      {showSearch || showAddButton ? (
        <div
          className={
            showAddButton
              ? "flex flex-col gap-2 sm:flex-row sm:items-center"
              : "flex flex-col gap-2"
          }
        >
          {showSearch ? (
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
          ) : null}
          {showAddButton ? (
            <Button onClick={onAddClick} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Add connection
            </Button>
          ) : null}
        </div>
      ) : null}

      {filteredConnections.length === 0 ? (
        connections.length === 0 ? (
          <div className="border-border/80 bg-muted/20 rounded-lg border border-dashed px-6 py-10 text-center">
            <h3 className="text-foreground text-base font-semibold">
              No remote signer connections yet
            </h3>
            <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm">
              Connect a signer app to publish securely without exposing your key
              to SmartFlow.
            </p>
            <Button
              type="button"
              className="mt-6"
              onClick={onAddClick}
              size="sm"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Add connection
            </Button>
            <p className="text-muted-foreground mt-4 text-xs">
              You can add more than one signer and switch between them later.
            </p>
          </div>
        ) : (
          <div className="text-muted-foreground rounded-md border p-8 text-center text-sm">
            No connections match your search
          </div>
        )
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredConnections.map((connection) => (
            <SessionCard
              key={connection.id}
              connection={connection}
              isActive={activeConnection?.id === connection.id}
              isPrimaryFallback={primarySignerProfileMatchesConnection(
                primarySignerProfile,
                connection
              )}
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

function primarySignerProfileMatchesConnection(
  profile: PrimarySignerProfile | null,
  connection: RemoteSignerConnection
): boolean {
  if (!profile?.expectedPubkey || !connection.metadata.pubkey) {
    return false;
  }
  const a =
    convertToHex(profile.expectedPubkey) ??
    profile.expectedPubkey.toLowerCase();
  const b =
    convertToHex(connection.metadata.pubkey) ??
    connection.metadata.pubkey.toLowerCase();
  return a.toLowerCase() === b.toLowerCase();
}
