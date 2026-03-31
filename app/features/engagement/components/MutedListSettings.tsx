import { useFetcher } from "@remix-run/react";
import { RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { Switch } from "~/components/ui/switch";
import {
  PreferenceSection,
  ToggleRowSection,
} from "~/features/settings/components/patterns";
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
      Last synced {formattedDate} {formattedTime}
    </p>
  );
}

function useFetcherSuccessToast(
  fetcher: ReturnType<typeof useFetcher<FetcherData>>,
  ok: string
) {
  const wasSubmittingRef = useRef(false);
  useEffect(() => {
    const wasSubmitting = wasSubmittingRef.current;
    wasSubmittingRef.current = fetcher.state === "submitting";
    if (!wasSubmitting || fetcher.state !== "idle") return;
    if (fetcher.data?.success) toast.success(ok);
    else if (fetcher.data?.error) toast.error(fetcher.data.error);
  }, [fetcher.state, fetcher.data, ok]);
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

  useFetcherSuccessToast(syncFetcher, "Muted list synced");
  useFetcherSuccessToast(toggleFetcher, "Muted filtering updated");
  useFetcherSuccessToast(toggleLowTrustFetcher, "Trust filter updated");

  return (
    <PreferenceSection
      title="Feed filtering"
      description="Control how muted accounts and trust signals affect what you see."
      contentClassName="space-y-0"
    >
      <div className="bg-muted/25 border-border/50 flex flex-col gap-3 rounded-md border px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-muted-foreground text-xs font-medium">
            Muted accounts
          </p>
          <p className="text-2xl font-semibold tabular-nums">{mutedCount}</p>
          {lastSyncedDate ? (
            <LastSyncedDateDisplay lastSyncedDate={lastSyncedDate} />
          ) : (
            <p className="text-muted-foreground text-xs">Not synced yet</p>
          )}
        </div>
        <Button
          type="button"
          onClick={handleSync}
          disabled={isSyncing}
          variant="outline"
          size="sm"
          className="shrink-0 self-start sm:self-center"
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`}
          />
          {isSyncing ? "Syncing…" : "Sync now"}
        </Button>
      </div>

      <Separator className="my-1" />

      <ToggleRowSection
        variant="plain"
        label="Enable muted filtering"
        description="Hide content from muted users in your engagement feed."
        control={
          <Switch
            id="filter-muted"
            checked={actualFilterState}
            onCheckedChange={handleToggleFilter}
            disabled={isToggling}
          />
        }
      />

      <Separator />

      <ToggleRowSection
        variant="plain"
        label="Hide posts from low-trust users"
        description="Filter out content from users with low trust scores in your engagement feed."
        control={
          <Switch
            id="hide-low-trust"
            checked={actualLowTrustState}
            onCheckedChange={handleToggleLowTrust}
            disabled={isTogglingLowTrust}
          />
        }
      />
    </PreferenceSection>
  );
}
