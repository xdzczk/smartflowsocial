import { format } from "date-fns";
import { Edit2, RefreshCw, Trash2, Check, X, Download } from "lucide-react";
import { useState } from "react";

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
import { convertHexToNpub } from "~/lib/nostr-conversion";
import {
  getConnectionHistory,
  maskConnectionUri,
  updateSession,
} from "~/lib/remote-signer-sessions.client";
import type { RemoteSignerSession } from "~/lib/remote-signer-sessions.client";

import { ConnectionHistory } from "./ConnectionHistory";
import { ConnectionStatusBadge } from "./ConnectionStatusBadge";

interface SessionDetailsDialogProps {
  session: RemoteSignerSession | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReconnect: (sessionId: string) => void;
  onSetActive?: (sessionId: string) => void;
  onRemove: (sessionId: string) => void;
}

export function SessionDetailsDialog({
  session,
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

  if (!session) {
    return null;
  }

  const handleEditLabel = () => {
    setEditedLabel(session.label);
    setIsEditingLabel(true);
  };

  const handleSaveLabel = () => {
    if (editedLabel.trim()) {
      updateSession(session.id, { label: editedLabel.trim() });
    }
    setIsEditingLabel(false);
  };

  const handleCancelLabel = () => {
    setEditedLabel("");
    setIsEditingLabel(false);
  };

  const handleEditAppName = () => {
    setEditedAppName(session.metadata.signerAppName ?? "");
    setIsEditingAppName(true);
  };

  const handleSaveAppName = () => {
    updateSession(session.id, {
      metadata: {
        ...session.metadata,
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
      id: session.id,
      label: session.label,
      config: {
        type: session.config.type,
        method:
          session.config.type === "nip46" ? session.config.method : undefined,
        // Don't export sensitive data like clientSecretKey
      },
      metadata: {
        signerAppName: session.metadata.signerAppName,
        pubkey: session.metadata.pubkey,
        relays: session.metadata.relays,
      },
      createdAt: new Date(session.metadata.createdAt).toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `remote-signer-session-${session.id}.json`;
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
    if (session.config.type === "nip46") {
      if (session.config.method === "nostrconnect_uri") {
        return session.config.uri;
      }
      // bunker_input method
      return session.config.bunkerInput;
    }
    return null;
  };

  const connectionUri = getConnectionUri();
  const history = getConnectionHistory(session.id);

  // Calculate statistics
  const totalConnections = history.filter((e) => e.type === "connect").length;
  const successfulConnections = history.filter(
    (e) => e.type === "connect" && e.status === "success"
  ).length;
  const successRate =
    totalConnections > 0
      ? Math.round((successfulConnections / totalConnections) * 100)
      : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Session Details</DialogTitle>
          <DialogDescription>
            View and manage remote signer session details
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="config">Configuration</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Session Label</Label>
                <div className="flex items-center gap-2">
                  {isEditingLabel ? (
                    <>
                      <Input
                        value={editedLabel}
                        onChange={(e) => setEditedLabel(e.target.value)}
                        className="w-48"
                      />
                      <Button size="sm" onClick={handleSaveLabel}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCancelLabel}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="font-medium">{session.label}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleEditLabel}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label>Signer App Name</Label>
                <div className="flex items-center gap-2">
                  {isEditingAppName ? (
                    <>
                      <Input
                        value={editedAppName}
                        onChange={(e) => setEditedAppName(e.target.value)}
                        className="w-48"
                        placeholder="Enter app name"
                      />
                      <Button size="sm" onClick={handleSaveAppName}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCancelAppName}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="text-muted-foreground">
                        {session.metadata.signerAppName ?? "Unknown"}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleEditAppName}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label>Status</Label>
                <ConnectionStatusBadge status={session.metadata.status} />
              </div>

              <div className="flex items-center justify-between">
                <Label>Pubkey</Label>
                <span className="font-mono text-sm">
                  {formatPubkey(session.metadata.pubkey)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <Label>Created</Label>
                <span className="text-sm">
                  {format(new Date(session.metadata.createdAt), "PPpp")}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <Label>Last Connected</Label>
                <span className="text-sm">
                  {session.metadata.connectedAt
                    ? format(new Date(session.metadata.connectedAt), "PPpp")
                    : "Never"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <Label>Last Activity</Label>
                <span className="text-sm">
                  {session.metadata.lastActivityAt
                    ? format(new Date(session.metadata.lastActivityAt), "PPpp")
                    : "Never"}
                </span>
              </div>

              {session.metadata.lastError ? (
                <div className="bg-destructive/10 border-destructive/20 text-destructive rounded-md border p-3">
                  <Label className="mb-1 block">Last Error</Label>
                  <p className="text-sm">{session.metadata.lastError}</p>
                </div>
              ) : null}

              <div className="bg-muted rounded-md p-4">
                <Label className="mb-2 block">Statistics</Label>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">
                      Total Connections
                    </div>
                    <div className="text-lg font-semibold">
                      {totalConnections}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Success Rate</div>
                    <div className="text-lg font-semibold">{successRate}%</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">History Entries</div>
                    <div className="text-lg font-semibold">
                      {history.length}
                    </div>
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
                  {session.config.type === "nip07"
                    ? "Browser Extension (NIP-07)"
                    : session.config.method === "nostrconnect_uri"
                      ? "NostrConnect URI"
                      : "Bunker Input"}
                </p>
              </div>

              {connectionUri ? (
                <div>
                  <Label>Connection URI (Masked)</Label>
                  <div className="bg-muted flex items-center justify-between rounded-md p-3">
                    <code className="text-sm">
                      {maskConnectionUri(connectionUri)}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        void navigator.clipboard.writeText(connectionUri);
                      }}
                    >
                      Copy Full
                    </Button>
                  </div>
                </div>
              ) : null}

              {session.metadata.relays.length > 0 ? (
                <div>
                  <Label>Relays</Label>
                  <div className="bg-muted rounded-md p-3">
                    <ul className="list-inside list-disc space-y-1">
                      {session.metadata.relays.map((relay) => (
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
            <ConnectionHistory entries={history} showFilters />
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
              onReconnect(session.id);
              onOpenChange(false);
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Reconnect
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onRemove(session.id);
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
