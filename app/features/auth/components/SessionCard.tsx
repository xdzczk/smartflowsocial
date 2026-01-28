import { formatDistanceToNow } from "date-fns";
import { Trash2, RefreshCw, Eye, Check } from "lucide-react";
import { useState } from "react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { convertHexToNpub } from "~/lib/nostr-conversion";
import type { RemoteSignerSession } from "~/lib/remote-signer-sessions.client";

import { ConnectionStatusBadge } from "./ConnectionStatusBadge";

interface SessionCardProps {
  session: RemoteSignerSession;
  isActive: boolean;
  onReconnect: (sessionId: string) => void;
  onSetActive: (sessionId: string) => void;
  onViewDetails: (sessionId: string) => void;
  onRemove: (sessionId: string) => void;
}

export function SessionCard({
  session,
  isActive,
  onReconnect,
  onSetActive,
  onViewDetails,
  onRemove,
}: SessionCardProps) {
  const [isRemoving, setIsRemoving] = useState(false);

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

  const handleRemove = () => {
    if (
      !confirm(
        `Are you sure you want to remove "${session.label}"? This action cannot be undone.`
      )
    ) {
      return;
    }
    setIsRemoving(true);
    try {
      onRemove(session.id);
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <Card
      className={`${isActive ? "border-primary" : ""} ${isRemoving ? "opacity-50" : ""}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{session.label}</CardTitle>
              {isActive ? (
                <Badge className="bg-primary text-primary-foreground text-xs">
                  Active
                </Badge>
              ) : null}
            </div>
            <CardDescription className="mt-1">
              {session.metadata.signerAppName ?? "Unknown Signer"}
            </CardDescription>
          </div>
          <div className="flex gap-1">
            {!isActive ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSetActive(session.id)}
                className="h-8"
              >
                <Check className="mr-1 h-3 w-3" />
                Set Active
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onReconnect(session.id)}
              className="h-8"
            >
              <RefreshCw className="mr-1 h-3 w-3" />
              Reconnect
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewDetails(session.id)}
              className="h-8"
            >
              <Eye className="mr-1 h-3 w-3" />
              Details
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              className="text-destructive hover:text-destructive h-8"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">Status</span>
          <ConnectionStatusBadge status={session.metadata.status} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Pubkey</span>
            <span className="font-mono text-sm">
              {formatPubkey(session.metadata.pubkey)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">
              Last Connected
            </span>
            <span className="text-sm">
              {formatTimestamp(session.metadata.connectedAt)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Last Activity</span>
            <span className="text-sm">
              {formatTimestamp(session.metadata.lastActivityAt)}
            </span>
          </div>
        </div>

        {session.metadata.lastError ? (
          <div className="bg-destructive/10 border-destructive/20 text-destructive rounded-md border p-2 text-xs">
            {session.metadata.lastError}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
