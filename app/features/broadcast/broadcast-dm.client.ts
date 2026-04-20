/**
 * Client-side kind 4 DM build/sign for broadcasts (same signer path as product feedback).
 */

import type { SignedEvent } from "~/features/nostr/types";
import { nostrAdapter } from "~/lib/nostr-adapter.client";
import { encryptNip04WithActiveSigner } from "~/lib/nostr-signer-encrypt.client";

export async function buildAndSignBroadcastKind4(params: {
  recipientPubkeyHex: string;
  plaintext: string;
}): Promise<SignedEvent> {
  const peer = params.recipientPubkeyHex.toLowerCase();
  const encrypted = await encryptNip04WithActiveSigner(peer, params.plaintext);

  const { signedEvent } = await nostrAdapter.signEvent(
    {
      kind: 4,
      tags: [["p", peer]],
      content: encrypted,
      created_at: Math.floor(Date.now() / 1000),
    },
    // `clearCacheOnError: false` keeps a transient bunker hiccup
    // surfacable as a recoverable signer error so the bulk wrapper in
    // `runBroadcastFinalizeFlow` can park the batch under the foreground
    // recovery banner instead of silently dropping a recipient.
    { clearCacheOnError: false }
  );

  return signedEvent;
}
