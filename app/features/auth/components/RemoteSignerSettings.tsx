import { useFetcher } from "@remix-run/react";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";

import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import {
  clearActiveSession,
  getAllConnections,
  getActiveConnection,
  getConnectionHistory,
  isPrimarySignerProfile,
  isSigningInProgress,
  recordConnectionEvent,
  REMOTE_SIGNER_TIMEOUT_EVENT,
  removeConnection,
  setActiveConnection,
  teardownActiveNip46Signer,
  testConnection,
  testPrimarySignerProfileConnection,
  type PrimarySignerProfile,
  type RemoteSignerConnection,
  type ReconnectDialogOpenMode,
} from "~/features/auth/signer";
import { ManagementListSection } from "~/features/settings/components/patterns";
import { BRAND_NAME } from "~/lib/brand";
import { useOptionalUser } from "~/lib/remix-utils";

import { RemoteSignerConnectionList } from "./RemoteSignerConnectionList";
import { RemoteSignerHealthSection } from "./RemoteSignerHealthSection";
import { RemoteSignerReconnectDialog } from "./RemoteSignerReconnectController";
import { SessionDetailsDialog } from "./SessionDetailsDialog";

interface RemoteSignerSettingsProps {
  primarySignerProfile?: PrimarySignerProfile | null;
}

export function RemoteSignerSettings(props: RemoteSignerSettingsProps) {
  const primarySignerFetcher = useFetcher<{
    success?: boolean;
    error?: string;
    primarySignerProfile?: unknown;
  }>();
  const user = useOptionalUser();
  const expectedPubkey = user?.npub ?? null;

  const [connections, setConnections] = useState<RemoteSignerConnection[]>([]);
  const [activeConnection, setActiveConnectionState] =
    useState<RemoteSignerConnection | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConnectionId, setSelectedConnectionId] = useState<
    string | null
  >(null);
  const [reconnectDialogOpen, setReconnectDialogOpen] = useState(false);
  const [reconnectDialogOpenMode, setReconnectDialogOpenMode] =
    useState<ReconnectDialogOpenMode>("default");
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isTestingPrimarySigner, setIsTestingPrimarySigner] = useState(false);
  const [primarySignerProfile, setPrimarySignerProfile] =
    useState<PrimarySignerProfile | null>(props.primarySignerProfile ?? null);

  useEffect(() => {
    setPrimarySignerProfile(props.primarySignerProfile ?? null);
  }, [props.primarySignerProfile]);

  useEffect(() => {
    if (primarySignerFetcher.state !== "idle") {
      return;
    }
    const payload = primarySignerFetcher.data;
    if (!payload) {
      return;
    }
    if (payload.error) {
      toast.error(payload.error);
      return;
    }
    if (!payload.success) {
      return;
    }
    const profile = isPrimarySignerProfile(payload.primarySignerProfile)
      ? payload.primarySignerProfile
      : null;
    setPrimarySignerProfile(profile);
    toast.success(
      profile
        ? "Primary fallback signer saved."
        : "Primary fallback signer cleared."
    );
  }, [primarySignerFetcher.data, primarySignerFetcher.state]);

  const loadConnections = useCallback(() => {
    setConnections(getAllConnections());
    setActiveConnectionState(getActiveConnection());
  }, []);

  useEffect(() => {
    loadConnections();

    const handleConnectionCreated = () => loadConnections();
    const handleConnectionUpdated = () => loadConnections();
    const handleConnectionRemoved = () => loadConnections();
    const handleActiveConnectionChanged = () => loadConnections();
    const handleConnectionStale = () => loadConnections();
    const handleConnectionHealthy = () => loadConnections();
    const handleTimeout = () => loadConnections();

    window.addEventListener(
      "remote-signer-session-created",
      handleConnectionCreated
    );
    window.addEventListener(
      "remote-signer-session-updated",
      handleConnectionUpdated
    );
    window.addEventListener(
      "remote-signer-session-removed",
      handleConnectionRemoved
    );
    window.addEventListener(
      "remote-signer-active-session-changed",
      handleActiveConnectionChanged
    );
    window.addEventListener("nostr-connection-stale", handleConnectionStale);
    window.addEventListener(
      "nostr-connection-healthy",
      handleConnectionHealthy
    );
    window.addEventListener(REMOTE_SIGNER_TIMEOUT_EVENT, handleTimeout);

    // Poll active connection health every 2 minutes (avoid prompting signer app too often).
    // Skip while signing is in progress so health check doesn't compete with sign requests on the same NIP-46 channel.
    const HEALTH_POLL_MS = 2 * 60 * 1000;
    const healthCheckInterval = setInterval(() => {
      if (isSigningInProgress()) return;
      const active = getActiveConnection();
      if (active?.metadata.status === "active") {
        void (async () => {
          const result = await testConnection(3000, {
            tryReconnectIfDisconnected: false,
          });
          recordConnectionEvent(active.id, {
            type: "health_check",
            healthy: result.healthy,
            error: result.error,
          });
          loadConnections();
        })();
      }
    }, HEALTH_POLL_MS);

    return () => {
      window.removeEventListener(
        "remote-signer-session-created",
        handleConnectionCreated
      );
      window.removeEventListener(
        "remote-signer-session-updated",
        handleConnectionUpdated
      );
      window.removeEventListener(
        "remote-signer-session-removed",
        handleConnectionRemoved
      );
      window.removeEventListener(
        "remote-signer-active-session-changed",
        handleActiveConnectionChanged
      );
      window.removeEventListener(
        "nostr-connection-stale",
        handleConnectionStale
      );
      window.removeEventListener(
        "nostr-connection-healthy",
        handleConnectionHealthy
      );
      window.removeEventListener(REMOTE_SIGNER_TIMEOUT_EVENT, handleTimeout);
      clearInterval(healthCheckInterval);
    };
  }, [loadConnections]);

  const openAddSignerDialog = useCallback(() => {
    setReconnectDialogOpenMode("new_session");
    setReconnectDialogOpen(true);
  }, []);

  const handleReconnect = useCallback(
    (connectionId: string) => {
      const conn = connections.find((c) => c.id === connectionId);
      if (!conn) return;
      setActiveConnection(connectionId);
      setReconnectDialogOpenMode("default");
      setReconnectDialogOpen(true);
    },
    [connections]
  );

  const handleSetActive = useCallback(
    (connectionId: string) => {
      setActiveConnection(connectionId);
      loadConnections();
    },
    [loadConnections]
  );

  const handleViewDetails = useCallback((connectionId: string) => {
    setSelectedConnectionId(connectionId);
  }, []);

  const handleRemove = useCallback(
    (connectionId: string) => {
      if (activeConnection?.id === connectionId) {
        teardownActiveNip46Signer();
      }
      removeConnection(connectionId);
      loadConnections();
      if (selectedConnectionId === connectionId) {
        setSelectedConnectionId(null);
      }
    },
    [activeConnection?.id, loadConnections, selectedConnectionId]
  );

  const handleTestConnection = useCallback(async () => {
    if (!activeConnection) return;

    setIsTestingConnection(true);
    try {
      const result = await testConnection();
      recordConnectionEvent(activeConnection.id, {
        type: "health_check",
        healthy: result.healthy,
        error: result.error,
      });
      loadConnections();
    } finally {
      setIsTestingConnection(false);
    }
  }, [activeConnection, loadConnections]);

  const handleDisconnect = useCallback(() => {
    if (!activeConnection) return;

    recordConnectionEvent(activeConnection.id, {
      type: "disconnected",
      reason: "User disconnected",
    });

    teardownActiveNip46Signer();
    clearActiveSession();
    loadConnections();
  }, [activeConnection, loadConnections]);

  const selectedConnection = selectedConnectionId
    ? (connections.find((c) => c.id === selectedConnectionId) ?? null)
    : null;

  const activeConnectionSupportsPrimarySave =
    activeConnection?.config.type === "nip46" ? activeConnection : null;

  const handleSaveActiveConnectionAsPrimary = useCallback(() => {
    if (!activeConnectionSupportsPrimarySave) {
      return;
    }
    if (activeConnectionSupportsPrimarySave.config.type !== "nip46") {
      return;
    }
    const formData = new FormData();
    formData.set("_action", "update_primary_signer_profile");
    formData.set("method", activeConnectionSupportsPrimarySave.config.method);
    formData.set("label", activeConnectionSupportsPrimarySave.label);
    if (activeConnectionSupportsPrimarySave.metadata.pubkey) {
      formData.set(
        "expectedPubkey",
        activeConnectionSupportsPrimarySave.metadata.pubkey
      );
    }
    if (activeConnectionSupportsPrimarySave.config.method === "bunker_input") {
      formData.set(
        "bunkerInput",
        activeConnectionSupportsPrimarySave.config.bunkerInput
      );
    } else {
      formData.set("uri", activeConnectionSupportsPrimarySave.config.uri);
      formData.set(
        "relays",
        activeConnectionSupportsPrimarySave.config.relays.join("\n")
      );
    }
    primarySignerFetcher.submit(formData, {
      method: "post",
      action: "/dashboard/settings",
    });
  }, [activeConnectionSupportsPrimarySave, primarySignerFetcher]);

  const handleClearPrimaryProfile = useCallback(() => {
    const formData = new FormData();
    formData.set("_action", "clear_primary_signer_profile");
    primarySignerFetcher.submit(formData, {
      method: "post",
      action: "/dashboard/settings",
    });
  }, [primarySignerFetcher]);

  const handleTestPrimaryProfile = useCallback(async () => {
    if (!primarySignerProfile) {
      return;
    }
    setIsTestingPrimarySigner(true);
    try {
      const result = await testPrimarySignerProfileConnection(
        primarySignerProfile,
        expectedPubkey
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Primary fallback signer is reachable and ready.");
    } finally {
      setIsTestingPrimarySigner(false);
    }
  }, [expectedPubkey, primarySignerProfile]);

  return (
    <>
      <div className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
        <p>
          Remote signers let {BRAND_NAME} publish and act on your behalf without
          storing your secret key. Connect a signer app to approve signing when
          needed.
        </p>
        <p className="mt-2">
          Adding a{" "}
          <span className="text-foreground font-medium">
            primary fallback signer
          </span>{" "}
          below is optional but recommended if you use {BRAND_NAME} on more than
          one device, so you can recover if a local session goes stale.
        </p>
      </div>

      <ManagementListSection
        title="Remote signer connections"
        description="Manage connected remote signers for publishing and account access. You can add multiple connections and switch between them."
        primaryAction={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openAddSignerDialog}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add connection
          </Button>
        }
      >
        <RemoteSignerConnectionList
          connections={connections}
          activeConnection={activeConnection}
          primarySignerProfile={primarySignerProfile}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onReconnect={handleReconnect}
          onSetActive={handleSetActive}
          onViewDetails={handleViewDetails}
          onRemove={handleRemove}
          onAddClick={openAddSignerDialog}
          showAddButton={false}
        />

        {activeConnection ? (
          <>
            <Separator className="my-4" />
            <RemoteSignerHealthSection
              activeConnection={activeConnection}
              isTestingConnection={isTestingConnection}
              onTestConnection={() => void handleTestConnection()}
              onDisconnect={handleDisconnect}
              getConnectionHistory={getConnectionHistory}
            />
          </>
        ) : null}
      </ManagementListSection>

      <ManagementListSection
        title="Primary fallback signer"
        description={`Set an account-level fallback signer so ${BRAND_NAME} can recover from stale local sessions across devices.`}
        footer={
          <div className="border-border/60 flex flex-col gap-2 border-t pt-4 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              onClick={handleSaveActiveConnectionAsPrimary}
              disabled={
                !activeConnectionSupportsPrimarySave ||
                primarySignerFetcher.state !== "idle"
              }
            >
              Use active signer as primary
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                void handleTestPrimaryProfile();
              }}
              disabled={
                !primarySignerProfile ||
                isTestingPrimarySigner ||
                primarySignerFetcher.state !== "idle"
              }
            >
              {isTestingPrimarySigner ? "Testing…" : "Test signer"}
            </Button>
            <Button
              variant="outline"
              className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
              onClick={handleClearPrimaryProfile}
              disabled={
                !primarySignerProfile || primarySignerFetcher.state !== "idle"
              }
            >
              Clear primary signer
            </Button>
          </div>
        }
      >
        {primarySignerProfile ? (
          <div className="border-border/80 bg-muted/25 rounded-lg border p-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-foreground text-base font-semibold">
                  {primarySignerProfile.label ?? "Saved fallback signer"}
                </h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  Saved on your account for recovery when a device session goes
                  stale.
                </p>
              </div>
              <span className="text-muted-foreground shrink-0 text-xs">
                Last updated{" "}
                {new Date(primarySignerProfile.updatedAt).toLocaleString()}
              </span>
            </div>
            <div className="text-muted-foreground mt-4 space-y-1 text-sm">
              <p>
                <span className="text-foreground font-medium">
                  Connection type:{" "}
                </span>
                {primarySignerProfile.method === "bunker_input"
                  ? "Signer connection string"
                  : "Connection link"}{" "}
                <span className="text-xs">
                  (
                  {primarySignerProfile.method === "bunker_input"
                    ? "NIP-46 bunker"
                    : "Nostr Connect"}
                  )
                </span>
              </p>
              {primarySignerProfile.method === "nostrconnect_uri" ? (
                <p>
                  <span className="text-foreground font-medium">Relays: </span>
                  {primarySignerProfile.relays.length} configured for this
                  fallback
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="border-border/80 bg-muted/20 rounded-lg border border-dashed p-6">
            <h3 className="text-foreground text-base font-semibold">
              No primary fallback signer configured
            </h3>
            <p className="text-muted-foreground mt-2 max-w-lg text-sm leading-relaxed">
              Set one to recover publishing access across devices if a local
              signer session becomes stale.
            </p>
            <p className="text-muted-foreground mt-3 text-xs">
              Recommended if you use {BRAND_NAME} on more than one device.
            </p>
          </div>
        )}
      </ManagementListSection>

      {reconnectDialogOpen ? (
        <RemoteSignerReconnectDialog
          open={reconnectDialogOpen}
          onOpenChange={setReconnectDialogOpen}
          expectedPubkey={expectedPubkey}
          openMode={reconnectDialogOpenMode}
          onReconnectSuccess={(_connectionId) => {
            setReconnectDialogOpen(false);
            loadConnections();
          }}
        />
      ) : null}

      <SessionDetailsDialog
        connection={selectedConnection}
        open={selectedConnection !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedConnectionId(null);
          }
        }}
        onReconnect={handleReconnect}
        onSetActive={handleSetActive}
        onRemove={handleRemove}
      />
    </>
  );
}
