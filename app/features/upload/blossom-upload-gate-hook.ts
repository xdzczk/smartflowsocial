import { useCallback, useEffect, useState } from "react";

import { SIGNER_CONFIG_HYDRATED_EVENT } from "~/features/auth/signer";
import { useUploadProvider } from "~/lib/query/hooks/useApiQuery";

import { isBlossomMediaUploadBlocked } from "./blossom-upload-gate";

/**
 * Tracks upload provider + signer presence for gating Blossom media pickers outside UnifiedComposer.
 */
export function useBlossomUploadGate(): {
  mediaUploadBlocked: boolean;
  uploadProviderKnown: boolean;
} {
  const [signerReady, setSignerReady] = useState<boolean | null>(null);
  const [windowNostr, setWindowNostr] = useState(
    () => typeof window !== "undefined" && !!window.nostr
  );
  const uploadProvider = useUploadProvider();
  const provider = uploadProvider.data?.provider;
  const known = uploadProvider.isSuccess || uploadProvider.isError;

  const refreshSigner = useCallback(() => {
    if (typeof window !== "undefined") {
      setWindowNostr(!!window.nostr);
    }
    void (async () => {
      const { getActiveSignerConfig } = await import("~/features/auth/signer");
      setSignerReady(!!getActiveSignerConfig());
    })();
  }, []);

  useEffect(() => {
    refreshSigner();
    const handler = () => refreshSigner();
    window.addEventListener(SIGNER_CONFIG_HYDRATED_EVENT, handler);
    return () =>
      window.removeEventListener(SIGNER_CONFIG_HYDRATED_EVENT, handler);
  }, [refreshSigner]);

  const mediaUploadBlocked = isBlossomMediaUploadBlocked({
    uploadProviderKnown: known,
    uploadProvider: provider,
    signerReady,
    windowNostrBridgePresent: windowNostr,
  });

  return { mediaUploadBlocked, uploadProviderKnown: known };
}
