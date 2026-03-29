/**
 * Blossom uploads require a Nostr signer (NIP-07 extension or NIP-46 remote).
 * Central gate so UI can disable pickers and handlers stay consistent.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { SIGNER_CONFIG_HYDRATED_EVENT } from "~/features/auth/signer";
import { getUploadProvider } from "~/lib/query/hooks/useApiQuery";

import { isBlossomProvider } from "./upload-provider-blossom.client";

export const BLOSSOM_MEDIA_REQUIRES_SIGNER_MESSAGE =
  "Connect a browser extension (NIP-07) or remote signer (NIP-46) in Settings to upload media with Blossom.";

export function isBlossomMediaUploadBlocked(args: {
  uploadProviderKnown: boolean;
  uploadProvider: string | undefined;
  signerReady: boolean | null;
  windowNostrBridgePresent: boolean;
}): boolean {
  if (!args.uploadProviderKnown) return false;
  if (!isBlossomProvider(args.uploadProvider)) return false;
  return !args.windowNostrBridgePresent && args.signerReady !== true;
}

/**
 * Tracks upload provider + signer presence for gating Blossom media pickers outside UnifiedComposer.
 */
export function useBlossomUploadGate(): {
  mediaUploadBlocked: boolean;
  uploadProviderKnown: boolean;
} {
  const [provider, setProvider] = useState<string | undefined>();
  const [known, setKnown] = useState(false);
  const [signerReady, setSignerReady] = useState<boolean | null>(null);
  const [windowNostr, setWindowNostr] = useState(
    () => typeof window !== "undefined" && !!window.nostr
  );

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

  const uploadProviderEffectActiveRef = useRef(true);

  useEffect(() => {
    uploadProviderEffectActiveRef.current = true;
    void (async () => {
      try {
        const d = await getUploadProvider();
        if (uploadProviderEffectActiveRef.current) {
          setProvider(d.provider);
        }
      } catch {
        // ignore — provider unknown until settings load
      } finally {
        if (uploadProviderEffectActiveRef.current) {
          setKnown(true);
        }
      }
    })();
    return () => {
      uploadProviderEffectActiveRef.current = false;
    };
  }, []);

  const mediaUploadBlocked = isBlossomMediaUploadBlocked({
    uploadProviderKnown: known,
    uploadProvider: provider,
    signerReady,
    windowNostrBridgePresent: windowNostr,
  });

  return { mediaUploadBlocked, uploadProviderKnown: known };
}
