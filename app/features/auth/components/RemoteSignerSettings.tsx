import { useFetcher } from "@remix-run/react";
import { Search, Plus, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { teardownActiveNip46Signer } from "~/lib/nostr-signer-manager.client";
import { testPrimarySignerProfileConnection } from "~/lib/primary-signer-failover.client";
import {
  type PrimarySignerProfile,
  isPrimarySignerProfile,
} from "~/lib/primary-signer-profile";
import { useOptionalUser } from "~/lib/remix-utils";
import { testConnection } from "~/lib/remote-signer-health.client";
import { REMOTE_SIGNER_TIMEOUT_EVENT } from "~/lib/remote-signer-reconnect.client";
import {
  clearActiveSession,
  getAllSessions,
  getActiveSession,
  removeSession,
  setActiveSession,
} from "~/lib/remote-signer-sessions.client";
import type { RemoteSignerSession } from "~/lib/remote-signer-sessions.client";
import { recordConnectionEvent } from "~/lib/remote-signer-status.client";

import { ConnectionHistory } from "./ConnectionHistory";
import { RemoteSignerReconnectDialog } from "./RemoteSignerReconnectController";
import { SessionCard } from "./SessionCard";
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

  const [sessions, setSessions] = useState<RemoteSignerSession[]>([]);
  const [activeSession, setActiveSessionState] =
    useState<RemoteSignerSession | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null
  );
  const [reconnectDialogOpen, setReconnectDialogOpen] = useState(false);
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
        ? "Primary signer profile saved."
        : "Primary signer profile cleared."
    );
  }, [primarySignerFetcher.data, primarySignerFetcher.state]);

  const loadSessions = useCallback(() => {
    const allSessions = getAllSessions();
    const active = getActiveSession();
    setSessions(allSessions);
    setActiveSessionState(active);
  }, []);

  useEffect(() => {
    loadSessions();

    // Listen to session events
    const handleSessionCreated = () => loadSessions();
    const handleSessionUpdated = () => loadSessions();
    const handleSessionRemoved = () => loadSessions();
    const handleActiveSessionChanged = () => loadSessions();

    // Listen to connection events
    const handleConnectionStale = () => {
      loadSessions();
    };
    const handleConnectionHealthy = () => {
      loadSessions();
    };
    const handleTimeout = () => {
      loadSessions();
    };

    window.addEventListener(
      "remote-signer-session-created",
      handleSessionCreated
    );
    window.addEventListener(
      "remote-signer-session-updated",
      handleSessionUpdated
    );
    window.addEventListener(
      "remote-signer-session-removed",
      handleSessionRemoved
    );
    window.addEventListener(
      "remote-signer-active-session-changed",
      handleActiveSessionChanged
    );
    window.addEventListener("nostr-connection-stale", handleConnectionStale);
    window.addEventListener(
      "nostr-connection-healthy",
      handleConnectionHealthy
    );
    window.addEventListener(REMOTE_SIGNER_TIMEOUT_EVENT, handleTimeout);

    // Poll active session health every 2 minutes (avoid prompting signer app too often)
    const HEALTH_POLL_MS = 2 * 60 * 1000;
    const healthCheckInterval = setInterval(() => {
      const active = getActiveSession();
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
          loadSessions();
        })();
      }
    }, HEALTH_POLL_MS);

    return () => {
      window.removeEventListener(
        "remote-signer-session-created",
        handleSessionCreated
      );
      window.removeEventListener(
        "remote-signer-session-updated",
        handleSessionUpdated
      );
      window.removeEventListener(
        "remote-signer-session-removed",
        handleSessionRemoved
      );
      window.removeEventListener(
        "remote-signer-active-session-changed",
        handleActiveSessionChanged
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
  }, [loadSessions]);

  const filteredSessions = sessions.filter((session) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      session.label.toLowerCase().includes(query) ||
      (session.metadata.signerAppName?.toLowerCase().includes(query) ??
        false) ||
      (session.metadata.pubkey?.toLowerCase().includes(query) ?? false)
    );
  });

  const handleReconnect = useCallback(
    (sessionId: string) => {
      const session = sessions.find((s) => s.id === sessionId);
      if (!session) return;

      // Set as active and open reconnect dialog
      setActiveSession(sessionId);
      setReconnectDialogOpen(true);
    },
    [sessions]
  );

  const handleSetActive = useCallback(
    (sessionId: string) => {
      setActiveSession(sessionId);
      loadSessions();
    },
    [loadSessions]
  );

  const handleViewDetails = useCallback((sessionId: string) => {
    setSelectedSessionId(sessionId);
  }, []);

  const handleRemove = useCallback(
    (sessionId: string) => {
      if (activeSession?.id === sessionId) {
        teardownActiveNip46Signer();
      }
      removeSession(sessionId);
      loadSessions();
      if (selectedSessionId === sessionId) {
        setSelectedSessionId(null);
      }
    },
    [activeSession?.id, loadSessions, selectedSessionId]
  );

  const handleTestConnection = useCallback(async () => {
    if (!activeSession) return;

    setIsTestingConnection(true);
    try {
      const result = await testConnection();
      recordConnectionEvent(activeSession.id, {
        type: "health_check",
        healthy: result.healthy,
        error: result.error,
      });
      loadSessions();
    } finally {
      setIsTestingConnection(false);
    }
  }, [activeSession, loadSessions]);

  const handleDisconnect = useCallback(() => {
    if (!activeSession) return;

    recordConnectionEvent(activeSession.id, {
      type: "disconnected",
      reason: "User disconnected",
    });

    teardownActiveNip46Signer();
    clearActiveSession();
    loadSessions();
  }, [activeSession, loadSessions]);

  const selectedSession = selectedSessionId
    ? (sessions.find((s) => s.id === selectedSessionId) ?? null)
    : null;

  const activeSessionSupportsPrimarySave =
    activeSession?.config.type === "nip46" ? activeSession : null;

  const handleSaveActiveSessionAsPrimary = useCallback(() => {
    if (!activeSessionSupportsPrimarySave) {
      return;
    }
    if (activeSessionSupportsPrimarySave.config.type !== "nip46") {
      return;
    }
    const formData = new FormData();
    formData.set("_action", "update_primary_signer_profile");
    formData.set("method", activeSessionSupportsPrimarySave.config.method);
    formData.set("label", activeSessionSupportsPrimarySave.label);
    if (activeSessionSupportsPrimarySave.metadata.pubkey) {
      formData.set(
        "expectedPubkey",
        activeSessionSupportsPrimarySave.metadata.pubkey
      );
    }
    if (activeSessionSupportsPrimarySave.config.method === "bunker_input") {
      formData.set(
        "bunkerInput",
        activeSessionSupportsPrimarySave.config.bunkerInput
      );
    } else {
      formData.set("uri", activeSessionSupportsPrimarySave.config.uri);
      formData.set(
        "relays",
        activeSessionSupportsPrimarySave.config.relays.join("\n")
      );
    }
    primarySignerFetcher.submit(formData, {
      method: "post",
      action: "/dashboard/settings",
    });
  }, [activeSessionSupportsPrimarySave, primarySignerFetcher]);

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
      toast.success("Primary signer profile is reachable and ready.");
    } finally {
      setIsTestingPrimarySigner(false);
    }
  }, [expectedPubkey, primarySignerProfile]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Remote Signer Sessions</CardTitle>
          <CardDescription>
            Manage your NIP-46 remote signer connections. You can have multiple
            sessions and switch between them.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2" />
              <Input
                id="remote-signer-sessions-search"
                name="remote-signer-sessions-search"
                placeholder="Search sessions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
              {searchQuery ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-1/2 right-1 h-6 w-6 -translate-y-1/2"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="h-3 w-3" />
                </Button>
              ) : null}
            </div>
            <Button
              onClick={() => setReconnectDialogOpen(true)}
              className="w-full sm:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Session
            </Button>
          </div>

          {filteredSessions.length === 0 ? (
            <div className="text-muted-foreground rounded-md border p-8 text-center">
              {searchQuery
                ? "No sessions match your search"
                : "No remote signer sessions. Click 'Add Session' to create one."}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  isActive={activeSession?.id === session.id}
                  onReconnect={handleReconnect}
                  onSetActive={handleSetActive}
                  onViewDetails={handleViewDetails}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          )}

          {activeSession ? (
            <>
              <Separator className="my-4" />
              <div>
                <div className="mb-4">
                  <h3 className="mb-2 text-lg font-semibold">Active Session</h3>
                  <div className="bg-muted/30 rounded-md border p-4">
                    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="font-medium">{activeSession.label}</div>
                        <div className="text-muted-foreground text-sm break-words">
                          {activeSession.metadata.signerAppName ??
                            "Unknown Signer"}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            void handleTestConnection();
                          }}
                          disabled={isTestingConnection}
                        >
                          <RefreshCw
                            className={`mr-2 h-4 w-4 ${isTestingConnection ? "animate-spin" : ""}`}
                          />
                          Test Connection
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleDisconnect}
                        >
                          Disconnect
                        </Button>
                      </div>
                    </div>

                    <Separator className="my-3" />
                    <div>
                      <h4 className="mb-2 text-sm font-medium">
                        Recent Runtime Events
                      </h4>
                      <ConnectionHistory
                        entries={activeSession.history.slice(0, 5)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Primary Home Signer</CardTitle>
          <CardDescription>
            Save one account-level NIP-46 signer profile as fallback so any
            device can recover from stale local sessions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/30 rounded-md border p-4">
            {primarySignerProfile ? (
              <div className="space-y-2">
                <div className="font-medium">
                  {primarySignerProfile.label ?? "Primary signer configured"}
                </div>
                <div className="text-muted-foreground text-sm">
                  Method:{" "}
                  {primarySignerProfile.method === "bunker_input"
                    ? "Bunker input"
                    : "nostrconnect URI"}
                </div>
                {primarySignerProfile.method === "nostrconnect_uri" ? (
                  <div className="text-muted-foreground text-sm">
                    Relays: {primarySignerProfile.relays.length}
                  </div>
                ) : null}
                <div className="text-muted-foreground text-xs">
                  Last updated:{" "}
                  {new Date(primarySignerProfile.updatedAt).toLocaleString()}
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground text-sm">
                No account-level primary signer is configured yet.
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handleSaveActiveSessionAsPrimary}
              disabled={
                !activeSessionSupportsPrimarySave ||
                primarySignerFetcher.state !== "idle"
              }
            >
              Use active session as primary
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                void handleTestPrimaryProfile();
              }}
              disabled={
                !primarySignerProfile ||
                isTestingPrimarySigner ||
                primarySignerFetcher.state !== "idle"
              }
            >
              {isTestingPrimarySigner ? "Testing..." : "Test primary signer"}
            </Button>
            <Button
              variant="outline"
              onClick={handleClearPrimaryProfile}
              disabled={
                !primarySignerProfile || primarySignerFetcher.state !== "idle"
              }
            >
              Clear primary signer
            </Button>
          </div>
        </CardContent>
      </Card>

      {reconnectDialogOpen ? (
        <RemoteSignerReconnectDialog
          open={reconnectDialogOpen}
          onOpenChange={setReconnectDialogOpen}
          expectedPubkey={expectedPubkey}
          onReconnectSuccess={(_sessionId) => {
            setReconnectDialogOpen(false);
            loadSessions();
          }}
        />
      ) : null}

      <SessionDetailsDialog
        session={selectedSession}
        open={selectedSession !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedSessionId(null);
          }
        }}
        onReconnect={handleReconnect}
        onSetActive={handleSetActive}
        onRemove={handleRemove}
      />
    </>
  );
}
