import { useMemo } from "react";

import { isBlossomMediaUploadBlocked } from "~/features/upload/blossom-upload-gate.client";
import { isBlossomProvider } from "~/features/upload/upload-provider-blossom.client";
import { useUploadProvider } from "~/lib/query/hooks/useApiQuery";

import { UnifiedComposerBlossomSignerMediaNote } from "./UnifiedComposerBlossomSignerMediaNote";

export function useUnifiedComposerMediaUploadGate(
  signerReady: boolean | null,
  windowNostrBridgePresent: boolean
) {
  const uploadProvider = useUploadProvider();
  const mediaUploadProvider = uploadProvider.data?.provider;
  const mediaUploadProviderKnown =
    uploadProvider.isSuccess || uploadProvider.isError;

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
