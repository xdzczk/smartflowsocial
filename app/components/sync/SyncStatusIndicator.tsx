/**
 * Minimalistic Sync Status Indicator
 * Shows current sync state with icon and brief text
 */

import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";

import { Skeleton } from "~/components/ui/skeleton";
import {
  getSyncState,
  subscribeToSyncState,
  checkNeedsAttention,
} from "~/lib/sync-manager.client";

type SyncState = "synced" | "syncing" | "needs_attention";

export function SyncStatusIndicator() {
  const queryClient = useQueryClient();
  // Always start as "synced" so server and client render the same (avoids hydration mismatch).
  // Real state is applied after mount in useEffect.
  const [syncState, setSyncState] = useState<SyncState>("synced");

  useEffect(() => {
    const id = setTimeout(() => setSyncState(getSyncState()), 0);
    const unsubscribe = subscribeToSyncState((state) => {
      setSyncState(state);
    });

    const checkInterval = setInterval(() => {
      checkNeedsAttention(queryClient);
    }, 30000);

    return () => {
      clearTimeout(id);
      unsubscribe();
      clearInterval(checkInterval);
    };
  }, [queryClient]);

  if (syncState === "synced") {
    return (
      <div className="text-muted-foreground flex items-center gap-1 text-xs">
        <CheckCircle className="h-3 w-3 text-green-500" />
        <span className="hidden sm:inline">Synced</span>
      </div>
    );
  }

  if (syncState === "syncing") {
    return (
      <div className="text-muted-foreground flex items-center gap-1 text-xs">
        <Skeleton className="h-3 w-3 rounded-full" />
        <span className="hidden sm:inline">Syncing...</span>
      </div>
    );
  }

  // needs_attention
  return (
    <div className="text-muted-foreground flex items-center gap-1 text-xs">
      <TriangleAlert className="h-3 w-3 text-yellow-500" />
      <span className="hidden sm:inline">Needs attention</span>
    </div>
  );
}
