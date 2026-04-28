import { formatDistanceToNow } from "date-fns";
import { Trash2, RefreshCw, Eye, Check } from "lucide-react";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import type { RemoteSignerConnection } from "~/features/auth/signer";
import { convertHexToNpub } from "~/lib/nostr-conversion";

import { ConnectionStatusBadge } from "./ConnectionStatusBadge";

interface SessionCardProps {
  connection: RemoteSignerConnection;
  isActive: boolean;
  /** Matches server-stored primary fallback signer profile (same pubkey). */
  isPrimaryFallback?: boolean;
  onReconnect: (connectionId: string) => void;
  onSetActive: (connectionId: string) => void;
  onViewDetails: (connectionId: string) => void;
  onRemove: (connectionId: string) => void;
}

export function SessionCard({
  connection,
  isActive,
  isPrimaryFallback = false,
  onReconnect,
  onSetActive,
  onViewDetails,
  onRemove,
}: SessionCardProps) {
  const [isRemoving, setIsRemoving] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const formatPubkey = (pubkey: string | null): string => {
    if (!pubkey) return "Not connected";
    const npub = pubkey.startsWith("npub") ? pubkey : convertHexToNpub(pubkey);
    if (npub.length <= 20) return npub;
    return `${npub.slice(0, 12)}...${npub.slice(-8)}`;
  };

  const formatTimestamp = (timestamp: number | null): string => {
    if (!timestamp) return "Never";
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  };

  const relayCount = connection.metadata.relays.length;
  const relaySummary =
    relayCount === 0
      ? "No relays on file"
      : relayCount === 1
        ? "1 relay"
        : `${relayCount} relays`;

  const handleRemove = () => {
    setIsRemoving(true);
    try {
      onRemove(connection.id);
      setShowRemoveConfirm(false);
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <Card
      className={`min-w-0 overflow-hidden ${isActive ? "border-brand" : ""} ${isRemoving ? "opacity-50" : ""}`}
    >
      <CardHeader className="pb-3">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">{connection.label}</CardTitle>
              {isActive ? <Badge variant="brand">Active signer</Badge> : null}
              {isPrimaryFallback ? (
                <Badge variant="secondary" className="text-xs">
                  Primary fallback signer
                </Badge>
              ) : null}
            </div>
            <CardDescription className="mt-1">
              {connection.metadata.signerAppName ?? "Unknown signer"}
            </CardDescription>
          </div>
          <div className="flex flex-shrink-0 flex-wrap justify-end gap-1.5">
            {!isActive ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSetActive(connection.id)}
                className="h-8"
              >
                <Check className="mr-1 h-3 w-3" />
                Set active
              </Button>
            ) : null}
            <Button
              variant={isActive ? "outline" : "default"}
              size="sm"
              onClick={() => onReconnect(connection.id)}
              className="h-8"
            >
              <RefreshCw className="mr-1 h-3 w-3" />
              Reconnect
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewDetails(connection.id)}
              className="h-8"
            >
              <Eye className="mr-1 h-3 w-3" />
              Details
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRemoveConfirm(true)}
              className="text-danger hover:text-danger h-8"
              aria-label="Remove connection"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <AlertDialog open={showRemoveConfirm} onOpenChange={setShowRemoveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove connection?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove &quot;{connection.label}&quot;?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={isRemoving}
              className="bg-danger text-danger-foreground hover:bg-danger/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <CardContent className="space-y-3">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <span className="text-text-secondary text-sm">Status</span>
          <ConnectionStatusBadge status={connection.metadata.status} />
        </div>

        <div className="space-y-2">
          <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-text-secondary text-sm">Relays</span>
            <span className="text-sm">{relaySummary}</span>
          </div>

          <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-text-secondary text-sm">Pubkey</span>
            <span className="min-w-0 font-mono text-sm break-all">
              {formatPubkey(connection.metadata.pubkey)}
            </span>
          </div>

          <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-text-secondary text-sm">Last Connected</span>
            <span className="text-sm">
              {formatTimestamp(connection.metadata.connectedAt)}
            </span>
          </div>

          <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-text-secondary text-sm">Last Activity</span>
            <span className="text-sm">
              {formatTimestamp(connection.metadata.lastActivityAt)}
            </span>
          </div>
        </div>

        {connection.metadata.lastError ? (
          <div className="bg-danger/10 border-danger/20 text-danger rounded-md border p-2 text-xs">
            {connection.metadata.lastError}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
