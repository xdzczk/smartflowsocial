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
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";

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

function LastSyncedDateDisplay({ lastSyncedDate }: { lastSyncedDate: Date }) {
  const { formatDate } = useFormattedDate();
  const formattedDate = formatDate(lastSyncedDate, {
    dateFormatOptions: {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  });
  const formattedTime = formatDate(lastSyncedDate, {
    dateFormatOptions: {
      hour: "2-digit",
      minute: "2-digit",
    },
  });

  return (
    <p className="text-muted-foreground text-xs">
      Last synced: {formattedDate} {formattedTime}
    </p>
  );
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
  const [isHideLowTrustEnabled, setIsHideLowTrustEnabled] = useState(
    hidePostsFromLowTrustUsers
  );

  const isSyncing = syncFetcher.state === "submitting";
  const isToggling = toggleFetcher.state === "submitting";
  const isTogglingLowTrust = toggleLowTrustFetcher.state === "submitting";

  // Update local state when fetcher data changes
  const actualFilterState = toggleFetcher.data?.filterMuted ?? isFilterEnabled;

  const actualLowTrustState =
    toggleLowTrustFetcher.data?.hidePostsFromLowTrustUsers ??
    isHideLowTrustEnabled;

  const mutedCount =
    syncFetcher.data?.mutedList?.npubs.length ?? mutedList?.npubs.length ?? 0;

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
        <div className="space-y-2 rounded-lg border p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                className={`mr-2 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`}
              />
              {isSyncing ? "Syncing..." : "Sync Now"}
            </Button>
          </div>

          {lastSyncedDate ? (
            <LastSyncedDateDisplay lastSyncedDate={lastSyncedDate} />
          ) : null}
        </div>

        {/* Success/Error Messages */}
        {syncFetcher.data?.success ? (
          <p className="text-success text-sm">
            Muted list synced successfully! Found {mutedCount} muted users.
          </p>
        ) : null}
        {syncFetcher.data?.error ? (
          <p className="text-destructive text-sm">{syncFetcher.data.error}</p>
        ) : null}

        {/* Filter Toggle */}
        <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <Label htmlFor="filter-muted" className="text-base">
              Enable Muted Filtering
            </Label>
            <p className="text-muted-foreground text-sm">
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

        {toggleFetcher.data?.success ? (
          <p className="text-success text-sm">
            Filter setting updated successfully!
          </p>
        ) : null}
        {toggleFetcher.data?.error ? (
          <p className="text-destructive text-sm">{toggleFetcher.data.error}</p>
        ) : null}

        {/* Hide Low Trust Users Toggle */}
        <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <Label htmlFor="hide-low-trust" className="text-base">
              Hide Posts from Low Trust Users
            </Label>
            <p className="text-muted-foreground text-sm">
              Filter out content from users with low trust scores in your
              engagement feed
            </p>
          </div>
          <Switch
            id="hide-low-trust"
            checked={actualLowTrustState}
            onCheckedChange={handleToggleLowTrust}
            disabled={isTogglingLowTrust}
          />
        </div>

        {toggleLowTrustFetcher.data?.success ? (
          <p className="text-success text-sm">
            Low trust filter setting updated successfully!
          </p>
        ) : null}
        {toggleLowTrustFetcher.data?.error ? (
          <p className="text-destructive text-sm">
            {toggleLowTrustFetcher.data.error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
