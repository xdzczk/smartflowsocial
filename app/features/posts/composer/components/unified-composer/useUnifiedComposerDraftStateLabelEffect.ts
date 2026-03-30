import type { FetcherWithComponents } from "@remix-run/react";
import { useEffect } from "react";

export function useUnifiedComposerDraftStateLabelEffect(
  fetcher: FetcherWithComponents<unknown>,
  onDraftStateLabelChange: ((label: string) => void) | undefined,
  pendingExplicitSaveDraftRef: React.MutableRefObject<boolean>,
  fetcherWasBusyRef: React.MutableRefObject<boolean>,
  composerDraftFingerprint: string,
  serverDraftSavedBaseline: string | null,
  setServerDraftSavedBaseline: React.Dispatch<
    React.SetStateAction<string | null>
  >,
  initialDraftId: string | null,
  skipLocalDraftRestore: boolean,
  draftPickerNavigateBase: string,
  navigate: (to: string, opts?: { replace?: boolean }) => void
) {
  /* Refs and setState are stable; deps match the previous inline effect in UnifiedComposer. */
  useEffect(() => {
    if (!onDraftStateLabelChange) return;

    const busy = fetcher.state !== "idle";

    if (busy) {
      fetcherWasBusyRef.current = true;
      onDraftStateLabelChange(
        pendingExplicitSaveDraftRef.current ? "Saving draft…" : "Saving…"
      );
      return;
    }

    const completedNetworkRequest = fetcherWasBusyRef.current;
    fetcherWasBusyRef.current = false;

    if (completedNetworkRequest && pendingExplicitSaveDraftRef.current) {
      pendingExplicitSaveDraftRef.current = false;
      const data = fetcher.data as
        | { error?: unknown; draftSaved?: boolean; draftId?: string }
        | undefined;
      const jsonError =
        data &&
        typeof data === "object" &&
        "error" in data &&
        data.error != null &&
        data.error !== "";
      const serverConfirmedSave =
        data &&
        typeof data === "object" &&
        data.draftSaved === true &&
        typeof data.draftId === "string" &&
        data.draftId.length > 0;
      if (!jsonError && serverConfirmedSave) {
        const savedDraftId = data.draftId;
        queueMicrotask(() => {
          setServerDraftSavedBaseline(composerDraftFingerprint);
          onDraftStateLabelChange("Draft saved");
          if (!initialDraftId && savedDraftId) {
            const base = draftPickerNavigateBase;
            const sep = base.includes("?") ? "&" : "?";
            navigate(
              `${base}${sep}draftId=${encodeURIComponent(savedDraftId)}`,
              { replace: true }
            );
          }
        });
        return;
      }
    }

    if (
      serverDraftSavedBaseline !== null &&
      composerDraftFingerprint === serverDraftSavedBaseline
    ) {
      onDraftStateLabelChange("Draft saved");
      return;
    }

    if (!initialDraftId && !skipLocalDraftRestore) {
      onDraftStateLabelChange("Saved locally");
      return;
    }

    onDraftStateLabelChange("");
    /* eslint-disable-next-line react-hooks/exhaustive-deps -- pendingExplicitSaveDraftRef, fetcherWasBusyRef, setServerDraftSavedBaseline are stable */
  }, [
    fetcher.state,
    fetcher.data,
    draftPickerNavigateBase,
    navigate,
    composerDraftFingerprint,
    serverDraftSavedBaseline,
    initialDraftId,
    skipLocalDraftRestore,
    onDraftStateLabelChange,
  ]);
}
