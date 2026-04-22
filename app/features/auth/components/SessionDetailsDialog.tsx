import { format } from "date-fns";
import { Edit2, RefreshCw, Trash2, Check, X, Download } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  getConnectionHistory,
  getSessionHistory,
  getSessionsForConnection,
  maskConnectionUri,
  updateSession,
} from "~/features/auth/signer";
import type { RemoteSignerConnection } from "~/features/auth/signer";
import { INLINE_ICON_SIZE_CLASS } from "~/lib/icon-constants";
import { convertHexToNpub } from "~/lib/nostr-conversion";

import { ConnectionHistory } from "./ConnectionHistory";
import { ConnectionStatusBadge } from "./ConnectionStatusBadge";

interface SessionDetailsDialogProps {
  connection: RemoteSignerConnection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReconnect: (connectionId: string) => void;
  onSetActive?: (connectionId: string) => void;
  onRemove: (connectionId: string) => void;
}

export function SessionDetailsDialog({
  connection,
  open,
  onOpenChange,
  onReconnect,
  onSetActive: _onSetActive,
  onRemove,
}: SessionDetailsDialogProps) {
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editedLabel, setEditedLabel] = useState("");
  const [isEditingAppName, setIsEditingAppName] = useState(false);
  const [editedAppName, setEditedAppName] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null
  );
  const [copiedConnectionUri, setCopiedConnectionUri] = useState(false);

  useEffect(() => {
    if (!copiedConnectionUri) return;
    const timer = window.setTimeout(() => setCopiedConnectionUri(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copiedConnectionUri]);

  if (!connection) {
    return null;
  }

  const handleEditLabel = () => {
    setEditedLabel(connection.label);
    setIsEditingLabel(true);
  };

  const handleSaveLabel = () => {
    if (editedLabel.trim()) {
      updateSession(connection.id, { label: editedLabel.trim() });
    }
    setIsEditingLabel(false);
  };

  const handleCancelLabel = () => {
    setEditedLabel("");
    setIsEditingLabel(false);
  };

  const handleEditAppName = () => {
    setEditedAppName(connection.metadata.signerAppName ?? "");
    setIsEditingAppName(true);
  };

  const handleSaveAppName = () => {
    updateSession(connection.id, {
      metadata: {
        ...connection.metadata,
        signerAppName: editedAppName.trim() || null,
      },
    });
    setIsEditingAppName(false);
  };

  const handleCancelAppName = () => {
    setEditedAppName("");
    setIsEditingAppName(false);
  };

  const handleExport = () => {
    const exportData = {
      id: connection.id,
      label: connection.label,
      config: {
        type: connection.config.type,
        method:
          connection.config.type === "nip46"
            ? connection.config.method
            : undefined,
        // Don't export sensitive data like clientSecretKey
      },
      metadata: {
        signerAppName: connection.metadata.signerAppName,
        pubkey: connection.metadata.pubkey,
        relays: connection.metadata.relays,
      },
      createdAt: new Date(connection.metadata.createdAt).toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `remote-signer-connection-${connection.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatPubkey = (pubkey: string | null): string => {
    if (!pubkey) return "Not connected";
    return pubkey.startsWith("npub") ? pubkey : convertHexToNpub(pubkey);
  };

  const getConnectionUri = (): string | null => {
    if (connection.config.type === "nip46") {
      if (connection.config.method === "nostrconnect_uri") {
        return connection.config.uri;
      }
      return connection.config.bunkerInput;
    }
    return null;
  };

  const connectionUri = getConnectionUri();
  const recentSessions = getSessionsForConnection(connection.id);
  const history =
    selectedSessionId !== null
      ? getSessionHistory(selectedSessionId)
      : getConnectionHistory(connection.id);

  const latestEvent = history[0] ?? null;
  const lastSuccessEvent = history.find((entry) => entry.status === "success");
  const failureCount = history.filter(
    (entry) => entry.status === "failure"
  ).length;
  const timeoutCount = history.filter(
    (entry) => entry.status === "timeout"
  ).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Connection Details</DialogTitle>
          <DialogDescription>
            View and manage remote signer connection and sessions
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="config">Configuration</TabsTrigger>
            <TabsTrigger value="history">Runtime Events</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Connection Label</Label>
                <div className="cluster">
                  {isEditingLabel ? (
                    <>
                      <Input
                        value={editedLabel}
                        onChange={(e) => setEditedLabel(e.target.value)}
                        className="w-48"
                      />
                      <Button size="sm" onClick={handleSaveLabel}>
                        <Check className={INLINE_ICON_SIZE_CLASS} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCancelLabel}
                      >
                        <X className={INLINE_ICON_SIZE_CLASS} />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="font-medium">{connection.label}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleEditLabel}
                      >
                        <Edit2 className={INLINE_ICON_SIZE_CLASS} />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label>Signer App Name</Label>
                <div className="cluster">
                  {isEditingAppName ? (
                    <>
                      <Input
                        value={editedAppName}
                        onChange={(e) => setEditedAppName(e.target.value)}
                        className="w-48"
                        placeholder="Enter app name"
                      />
                      <Button size="sm" onClick={handleSaveAppName}>
                        <Check className={INLINE_ICON_SIZE_CLASS} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCancelAppName}
                      >
                        <X className={INLINE_ICON_SIZE_CLASS} />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="text-text-secondary">
                        {connection.metadata.signerAppName ?? "Unknown signer"}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleEditAppName}
                      >
                        <Edit2 className={INLINE_ICON_SIZE_CLASS} />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label>Status</Label>
                <ConnectionStatusBadge status={connection.metadata.status} />
              </div>

              <div className="flex items-center justify-between">
                <Label>Pubkey</Label>
                <span className="font-mono text-sm">
                  {formatPubkey(connection.metadata.pubkey)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <Label>Created</Label>
                <span className="text-sm">
                  {format(new Date(connection.metadata.createdAt), "PPpp")}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <Label>Last Connected</Label>
                <span className="text-sm">
                  {connection.metadata.connectedAt
                    ? format(new Date(connection.metadata.connectedAt), "PPpp")
                    : "Never"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <Label>Last Activity</Label>
                <span className="text-sm">
                  {connection.metadata.lastActivityAt
                    ? format(
                        new Date(connection.metadata.lastActivityAt),
                        "PPpp"
                      )
                    : "Never"}
                </span>
              </div>

              {connection.metadata.lastError ? (
                <div className="bg-danger/10 border-danger/20 text-danger rounded-md border p-3">
                  <Label className="mb-1 block">Last Error</Label>
                  <p className="text-sm">{connection.metadata.lastError}</p>
                </div>
              ) : null}

              <div className="bg-surface-hover rounded-md p-4">
                <Label className="mb-2 block">Runtime Snapshot</Label>
                <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                  <div>
                    <div className="text-text-secondary">Latest Outcome</div>
                    <div className="text-sm font-semibold">
                      {latestEvent
                        ? `${latestEvent.status} (${latestEvent.type})`
                        : "No events"}
                    </div>
                  </div>
                  <div>
                    <div className="text-text-secondary">Last Success</div>
                    <div className="text-sm font-semibold">
                      {lastSuccessEvent
                        ? format(new Date(lastSuccessEvent.timestamp), "PPp")
                        : "Never"}
                    </div>
                  </div>
                  <div>
                    <div className="text-text-secondary">Failures</div>
                    <div className="text-lg font-semibold">{failureCount}</div>
                  </div>
                  <div>
                    <div className="text-text-secondary">Timeouts</div>
                    <div className="text-lg font-semibold">{timeoutCount}</div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="config" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label>Connection Method</Label>
                <p className="text-sm">
                  {connection.config.type === "nip07"
                    ? "Browser Extension (NIP-07)"
                    : connection.config.method === "nostrconnect_uri"
                      ? "NostrConnect URI"
                      : "Bunker Input"}
                </p>
              </div>

              {connectionUri ? (
                <div>
                  <Label>Connection URI (Masked)</Label>
                  <div className="bg-surface-hover flex items-center justify-between rounded-md p-3">
                    <code className="text-sm">
                      {maskConnectionUri(connectionUri)}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        void navigator.clipboard.writeText(connectionUri);
                        setCopiedConnectionUri(true);
                      }}
                    >
                      {copiedConnectionUri ? "Copied" : "Copy Full"}
                    </Button>
                  </div>
                </div>
              ) : null}

              {connection.metadata.relays.length > 0 ? (
                <div>
                  <Label>Relays</Label>
                  <div className="bg-surface-hover rounded-md p-3">
                    <ul className="list-inside list-disc space-y-1">
                      {connection.metadata.relays.map((relay) => (
                        <li key={relay} className="font-mono text-sm">
                          {relay}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            {recentSessions.length > 0 ? (
              <div className="space-y-2">
                <Label>Recent sessions</Label>
                <ul className="bg-surface-hover divide-y rounded-md border">
                  <li>
                    <button
                      type="button"
                      onClick={() => setSelectedSessionId(null)}
                      className={`hover:bg-surface-hover/80 w-full px-3 py-2 text-left text-sm ${selectedSessionId === null ? "bg-surface-hover/80 font-medium" : ""}`}
                    >
                      Current session
                    </button>
                  </li>
                  {recentSessions.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedSessionId(s.id)}
                        className={`hover:bg-surface-hover/80 w-full px-3 py-2 text-left text-sm ${selectedSessionId === s.id ? "bg-surface-hover/80 font-medium" : ""}`}
                      >
                        {format(new Date(s.startedAt), "PPp")}
                        {s.endedAt != null
                          ? ` – ${format(new Date(s.endedAt), "PPp")}`
                          : ""}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div>
              <Label className="mb-2 block">
                {selectedSessionId === null
                  ? "Current session events"
                  : "Session events"}
              </Label>
              <ConnectionHistory entries={history} showFilters />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              onReconnect(connection.id);
              onOpenChange(false);
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Reconnect
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onRemove(connection.id);
              onOpenChange(false);
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Remove
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
