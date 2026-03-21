/**
 * NIP-04 / NIP-44 encrypt using the same identity as `nostrAdapter.signEvent`:
 * prefer the configured active signer (NIP-46 bunker RPCs), else `window.nostr`.
 */

export async function encryptNip04WithActiveSigner(
  thirdPartyPubkeyHex: string,
  plaintext: string
): Promise<string> {
  const { getActiveSigner, getActiveSignerConfig } =
    await import("~/features/auth/signer");
  const signer = await getActiveSigner();
  if (signer) {
    return signer.nip04Encrypt(thirdPartyPubkeyHex, plaintext);
  }
  const cfg = getActiveSignerConfig();
  if (cfg?.type === "nip46") {
    throw new Error(
      "Remote signer is not connected. Open your signer app and try again."
    );
  }
  if (typeof window !== "undefined" && window.nostr?.nip04?.encrypt) {
    return window.nostr.nip04.encrypt(thirdPartyPubkeyHex, plaintext);
  }
  throw new Error(
    "NIP-04 encryption is not available. Use a remote signer that supports nip04_encrypt (NIP-46), or a browser extension with NIP-04."
  );
}

export async function encryptNip44WithActiveSigner(
  thirdPartyPubkeyHex: string,
  plaintext: string
): Promise<string> {
  const { getActiveSigner, getActiveSignerConfig } =
    await import("~/features/auth/signer");
  const signer = await getActiveSigner();
  if (signer) {
    return signer.nip44Encrypt(thirdPartyPubkeyHex, plaintext);
  }
  const cfg = getActiveSignerConfig();
  if (cfg?.type === "nip46") {
    throw new Error(
      "Remote signer is not connected. Open your signer app and try again."
    );
  }
  if (typeof window !== "undefined" && window.nostr?.nip44?.encrypt) {
    return window.nostr.nip44.encrypt(thirdPartyPubkeyHex, plaintext);
  }
  throw new Error(
    "NIP-44 encryption is not available. Use a remote signer that supports nip44_encrypt (NIP-46), or an extension with optional NIP-44."
  );
}
