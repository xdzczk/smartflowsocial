import { useFetcher } from "@remix-run/react";
import { RefreshCw } from "lucide-react";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";

interface MutedListSettingsProps {
  mutedList: {
    npubs: string[];
    lastSynced: string;
  } | null;
  filterMuted: boolean;
  hidePostsFromLowTrustUsers: boolean;
}

interface FetcherData {
  success?: boolean;
  error?: string;
  filterMuted?: boolean;
  hidePostsFromLowTrustUsers?: boolean;
  mutedList?: {
    npubs: string[];
    lastSynced: string;
  };
}

export function MutedListSettings({
  mutedList,
  filterMuted,
  hidePostsFromLowTrustUsers,
}: MutedListSettingsProps) {
  const syncFetcher = useFetcher<FetcherData>();
  const toggleFetcher = useFetcher<FetcherData>();
  const toggleLowTrustFetcher = useFetcher<FetcherData>();

  const [isFilterEnabled, setIsFilterEnabled] = useState(filterMuted);
  const [isHideLowTrustEnabled, setIsHideLowTrustEnabled] = useState(hidePostsFromLowTrustUsers);

  const isSyncing = syncFetcher.state === "submitting";
  const isToggling = toggleFetcher.state === "submitting";
  const isTogglingLowTrust = toggleLowTrustFetcher.state === "submitting";

  // Update local state when fetcher data changes
  const actualFilterState =
    toggleFetcher.data?.filterMuted !== undefined
      ? toggleFetcher.data.filterMuted
      : isFilterEnabled;

  const actualLowTrustState =
    toggleLowTrustFetcher.data?.hidePostsFromLowTrustUsers !== undefined
      ? toggleLowTrustFetcher.data.hidePostsFromLowTrustUsers
      : isHideLowTrustEnabled;

  const mutedCount =
    syncFetcher.data?.mutedList?.npubs?.length ||
    mutedList?.npubs?.length ||
    0;

  const lastSyncedDate = syncFetcher.data?.mutedList?.lastSynced
    ? new Date(syncFetcher.data.mutedList.lastSynced)
    : mutedList?.lastSynced
      ? new Date(mutedList.lastSynced)
      : null;

  const handleSync = () => {
    const formData = new FormData();
    formData.set("_action", "sync_muted_list");
    syncFetcher.submit(formData, { method: "post" });
  };

  const handleToggleFilter = (checked: boolean) => {
    setIsFilterEnabled(checked);
    const formData = new FormData();
    formData.set("_action", "toggle_filter_muted");
    formData.set("filterMuted", checked.toString());
    toggleFetcher.submit(formData, { method: "post" });
  };

  const handleToggleLowTrust = (checked: boolean) => {
    setIsHideLowTrustEnabled(checked);
    const formData = new FormData();
    formData.set("_action", "toggle_hide_low_trust");
    formData.set("hidePostsFromLowTrustUsers", checked.toString());
    toggleLowTrustFetcher.submit(formData, { method: "post" });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Muted List</CardTitle>
        <CardDescription>
          Sync your Nostr muted list and enable filtering
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Muted List Info */}
        <div className="rounded-lg border p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Muted Users</p>
              <p className="text-2xl font-bold">{mutedCount}</p>
            </div>
            <Button
              onClick={handleSync}
              disabled={isSyncing}
              variant="outline"
              size="sm"
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`}
              />
              {isSyncing ? "Syncing..." : "Sync Now"}
            </Button>
          </div>

          {lastSyncedDate ? <p className="text-xs text-muted-foreground">
              Last synced:{" "}
              {lastSyncedDate.toLocaleDateString()}{" "}
              {lastSyncedDate.toLocaleTimeString()}
            </p> : null}
        </div>

        {/* Success/Error Messages */}
        {syncFetcher.data?.success ? <p className="text-sm text-green-600">
            Muted list synced successfully! Found {mutedCount} muted users.
          </p> : null}
        {syncFetcher.data?.error ? <p className="text-sm text-destructive">{syncFetcher.data.error}</p> : null}

        {/* Filter Toggle */}
        <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
          <div className="flex-1 space-y-1">
            <Label htmlFor="filter-muted" className="text-base">
              Enable Muted Filtering
            </Label>
            <p className="text-sm text-muted-foreground">
              Hide content from muted users in your engagement feed
            </p>
          </div>
          <Switch
            id="filter-muted"
            checked={actualFilterState}
            onCheckedChange={handleToggleFilter}
            disabled={isToggling}
          />
        </div>

        {toggleFetcher.data?.success ? <p className="text-sm text-green-600">
            Filter setting updated successfully!
          </p> : null}
        {toggleFetcher.data?.error ? <p className="text-sm text-destructive">
            {toggleFetcher.data.error}
          </p> : null}

        {/* Hide Low Trust Users Toggle */}
        <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
          <div className="flex-1 space-y-1">
            <Label htmlFor="hide-low-trust" className="text-base">
              Hide Posts from Low Trust Users
            </Label>
            <p className="text-sm text-muted-foreground">
              Filter out content from users with low trust scores in your engagement feed
            </p>
          </div>
          <Switch
            id="hide-low-trust"
            checked={actualLowTrustState}
            onCheckedChange={handleToggleLowTrust}
            disabled={isTogglingLowTrust}
          />
        </div>

        {toggleLowTrustFetcher.data?.success ? <p className="text-sm text-green-600">
            Low trust filter setting updated successfully!
          </p> : null}
        {toggleLowTrustFetcher.data?.error ? <p className="text-sm text-destructive">
            {toggleLowTrustFetcher.data.error}
          </p> : null}
      </CardContent>
    </Card>
  );
}
