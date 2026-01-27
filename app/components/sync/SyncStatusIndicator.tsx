/**
 * Minimalistic Sync Status Indicator
 * Shows current sync state with icon and brief text
 */

import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/20/solid";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import {
  getSyncState,
  subscribeToSyncState,
  checkNeedsAttention,
} from "~/lib/sync-manager.client";

type SyncState = "synced" | "syncing" | "needs_attention";

export function SyncStatusIndicator() {
  const queryClient = useQueryClient();
  const [syncState, setSyncState] = useState<SyncState>(getSyncState());

  useEffect(() => {
    // Subscribe to sync state changes
    const unsubscribe = subscribeToSyncState((state) => {
      setSyncState(state);
    });

    // Periodically check for posts that need attention
    const checkInterval = setInterval(() => {
      checkNeedsAttention(queryClient);
    }, 30000); // Check every 30 seconds

    return () => {
      unsubscribe();
      clearInterval(checkInterval);
    };
  }, [queryClient]);

  if (syncState === "synced") {
    return (
      <div className="text-muted-foreground flex items-center gap-1 text-xs">
        <CheckCircleIcon className="h-3 w-3 text-green-500" />
        <span className="hidden sm:inline">Synced</span>
      </div>
    );
  }

  if (syncState === "syncing") {
    return (
      <div className="text-muted-foreground flex items-center gap-1 text-xs">
        <div className="animate-pulse-subtle h-3 w-3 rounded-full bg-blue-500" />
        <span className="hidden sm:inline">Syncing...</span>
      </div>
    );
  }

  // needs_attention
  return (
    <div className="text-muted-foreground flex items-center gap-1 text-xs">
      <ExclamationTriangleIcon className="h-3 w-3 text-yellow-500" />
      <span className="hidden sm:inline">Needs attention</span>
    </div>
  );
}
