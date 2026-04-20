/**
 * Create NIP-46 signer from stored config (bunker or Nostr Connect reconnect).
 * Used by getActiveSigner.
 *
 * On cold rebuild we deliberately skip the `getPublicKey()` validation
 * round-trip. The original login already proved this bunker works, the
 * stored bunker pointer is authoritative, and a probe RPC here just races
 * the user's first `signEvent` for the bunker's reply over the per-RPC
 * subscription. `@nostrify`'s `NConnectSigner` (used by Ditto) follows the
 * same "don't probe on construct" pattern.
 */

import type { SimplePool } from "nostr-tools";

import {
  connectNip46ReconnectWithStoredNostrConnect,
  connectNip46WithBunkerInput,
  type Nip46Signer,
} from "~/features/auth/nostr-signer.client";
import { getSharedPool } from "~/features/nostr/shared-pool.client";

import { hexToBytes } from "./nostr-signer-keys.client";
import type { ActiveSignerConfig } from "./nostr-signer-storage.client";

export async function createNip46SignerFromStoredConfig(
  config: Extract<ActiveSignerConfig, { type: "nip46" }>,
  options: { pool?: SimplePool; timeoutMs?: number } = {}
): Promise<{ signer: Nip46Signer; pubkey: string }> {
  const clientSecretKey = hexToBytes(config.clientSecretKeyHex);
  const pool = options.pool ?? getSharedPool();
  const timeoutMs = options.timeoutMs ?? 90_000;

  if (config.method === "bunker_input") {
    return connectNip46WithBunkerInput({
      bunkerInput: config.bunkerInput,
      clientSecretKey,
      pool,
      timeoutMs,
      skipConnect: true,
      skipValidation: true,
      relays: config.relays,
    });
  }

  if (config.bunkerPointer) {
    return connectNip46ReconnectWithStoredNostrConnect({
      clientSecretKey,
      bunkerPointer: config.bunkerPointer,
      relays: config.bunkerPointer.relays,
      pool,
      timeoutMs,
      skipValidation: true,
    });
  }
  if (config.signerPubkey && config.relays.length > 0) {
    return connectNip46ReconnectWithStoredNostrConnect({
      clientSecretKey,
      signerPubkey: config.signerPubkey,
      relays: config.relays,
      pool,
      timeoutMs,
      skipValidation: true,
    });
  }
  throw new Error(
    "createNip46SignerFromStoredConfig: nostrconnect config needs bunkerPointer or signerPubkey+relays for reconnect"
  );
}
