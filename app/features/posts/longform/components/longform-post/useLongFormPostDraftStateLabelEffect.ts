import type { FetcherWithComponents } from "@remix-run/react";
import { useEffect } from "react";

export function useLongFormPostDraftStateLabelEffect(
  fetcher: FetcherWithComponents<unknown>,
  onDraftStateLabelChange: ((label: string) => void) | undefined,
  pendingLongformSaveDraftRef: React.MutableRefObject<boolean>,
  longformFetcherWasBusyRef: React.MutableRefObject<boolean>,
  longformDraftFingerprint: string,
  longformDraftSavedBaseline: string | null,
  setLongformDraftSavedBaseline: React.Dispatch<
    React.SetStateAction<string | null>
  >,
  setServerLongFormPostId: React.Dispatch<React.SetStateAction<string | null>>,
  initialData: { id?: string } | null,
  skipLocalDraftRestore: boolean
) {
  useEffect(() => {
    if (!onDraftStateLabelChange) return;

    const busy = fetcher.state !== "idle";

    if (busy) {
      longformFetcherWasBusyRef.current = true;
      onDraftStateLabelChange(
        pendingLongformSaveDraftRef.current ? "Saving draft…" : "Saving…"
      );
      return;
    }

    const completedNetworkRequest = longformFetcherWasBusyRef.current;
    longformFetcherWasBusyRef.current = false;

    if (completedNetworkRequest && pendingLongformSaveDraftRef.current) {
      pendingLongformSaveDraftRef.current = false;
      const data = fetcher.data as
        | {
            error?: unknown;
            draftSaved?: boolean;
            longFormPostId?: string;
          }
        | undefined;
      const jsonError =
        data &&
        typeof data === "object" &&
        "error" in data &&
        data.error != null &&
        data.error !== "";
      const serverSaved =
        data &&
        typeof data === "object" &&
        data.draftSaved === true &&
        typeof data.longFormPostId === "string" &&
        data.longFormPostId.length > 0;
      if (!jsonError && serverSaved) {
        const savedId = (data as { longFormPostId: string }).longFormPostId;
        queueMicrotask(() => {
          setServerLongFormPostId(savedId);
          setLongformDraftSavedBaseline(longformDraftFingerprint);
          onDraftStateLabelChange("Draft saved");
        });
        return;
      }
    }

    if (
      longformDraftSavedBaseline !== null &&
      longformDraftFingerprint === longformDraftSavedBaseline
    ) {
      onDraftStateLabelChange("Draft saved");
      return;
    }

    if (!initialData && !skipLocalDraftRestore) {
      onDraftStateLabelChange("Saved locally");
      return;
    }

    onDraftStateLabelChange("");
    /* eslint-disable-next-line react-hooks/exhaustive-deps -- refs and setters stable */
  }, [
    fetcher.state,
    fetcher.data,
    longformDraftFingerprint,
    longformDraftSavedBaseline,
    initialData,
    skipLocalDraftRestore,
    onDraftStateLabelChange,
  ]);
}
