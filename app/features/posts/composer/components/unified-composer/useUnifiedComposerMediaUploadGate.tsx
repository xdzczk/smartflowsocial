import { useEffect, useMemo, useRef, useState } from "react";

import { isBlossomMediaUploadBlocked } from "~/features/upload/blossom-upload-gate.client";
import { isBlossomProvider } from "~/features/upload/upload-provider-blossom.client";
import { getUploadProvider } from "~/lib/query/hooks/useApiQuery";

import { UnifiedComposerBlossomSignerMediaNote } from "./UnifiedComposerBlossomSignerMediaNote";

export function useUnifiedComposerMediaUploadGate(
  signerReady: boolean | null,
  windowNostrBridgePresent: boolean
) {
  const [mediaUploadProvider, setMediaUploadProvider] = useState<
    string | undefined
  >();
  const [mediaUploadProviderKnown, setMediaUploadProviderKnown] =
    useState(false);

  const uploadProviderFetchActiveRef = useRef(false);
  useEffect(() => {
    uploadProviderFetchActiveRef.current = true;
    void (async () => {
      try {
        const d = await getUploadProvider();
        if (uploadProviderFetchActiveRef.current) {
          setMediaUploadProvider(d.provider);
        }
      } catch {
        // ignore — treat as unknown provider until a later refresh
      } finally {
        if (uploadProviderFetchActiveRef.current) {
          setMediaUploadProviderKnown(true);
        }
      }
    })();
    return () => {
      uploadProviderFetchActiveRef.current = false;
    };
  }, []);

  const blossomMediaUploads =
    mediaUploadProviderKnown && isBlossomProvider(mediaUploadProvider);

  const blossomMediaBlocked = useMemo(
    () =>
      isBlossomMediaUploadBlocked({
        uploadProviderKnown: mediaUploadProviderKnown,
        uploadProvider: mediaUploadProvider,
        signerReady,
        windowNostrBridgePresent,
      }),
    [
      mediaUploadProviderKnown,
      mediaUploadProvider,
      signerReady,
      windowNostrBridgePresent,
    ]
  );

  const blossomSignerMediaNote = useMemo(() => {
    if (!blossomMediaUploads || !blossomMediaBlocked) {
      return;
    }
    return <UnifiedComposerBlossomSignerMediaNote />;
  }, [blossomMediaUploads, blossomMediaBlocked]);

  const attachmentFailedTitleHint =
    blossomMediaUploads && blossomMediaBlocked
      ? "Upload failed. Reconnect your Nostr signer in Settings, remove this file, and add it again."
      : undefined;

  return {
    blossomMediaBlocked,
    blossomSignerMediaNote,
    attachmentFailedTitleHint,
  };
}
