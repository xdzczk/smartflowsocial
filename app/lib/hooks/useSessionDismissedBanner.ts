import { useCallback, useMemo, useState, useSyncExternalStore } from "react";

const subscribeNoop = () => () => {};
const getClientMountedSnapshot = () => true;
const getServerMountedSnapshot = () => false;

export function sessionDismissStorageKey(scope: string, id: string): string {
  return `smartflowsocial:dismissed-${scope}:${id}`;
}

function readSessionDismissed(storageKey: string): boolean {
  try {
    return sessionStorage.getItem(storageKey) === "1";
  } catch {
    return false;
  }
}

export function useSessionDismissedBanner(storageKey: string): {
  isDismissed: boolean;
  dismiss: () => void;
} {
  const isClientMounted = useSyncExternalStore(
    subscribeNoop,
    getClientMountedSnapshot,
    getServerMountedSnapshot
  );
  const [dismissedLocally, setDismissedLocally] = useState(false);
  const isDismissedFromStorage = useMemo(() => {
    if (!isClientMounted) return false;
    return readSessionDismissed(storageKey);
  }, [isClientMounted, storageKey]);

  const dismiss = useCallback(() => {
    try {
      sessionStorage.setItem(storageKey, "1");
    } catch {
      // Ignore storage access errors.
    }
    setDismissedLocally(true);
  }, [storageKey]);

  return {
    isDismissed: isDismissedFromStorage || dismissedLocally,
    dismiss,
  };
}
