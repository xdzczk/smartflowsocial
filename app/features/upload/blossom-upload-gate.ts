import { isBlossomProvider } from "./upload-provider-blossom";

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
