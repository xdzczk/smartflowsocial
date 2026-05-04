/**
 * Boot-time signer warm-up.
 *
 * On a cold reopen, the FIRST sign attempt would otherwise have to:
 *   1. Open the shared SimplePool's WebSockets from cold.
 *   2. Reconstruct the `Nip46Signer` from the persisted bunker pointer.
 *   3. Subscribe for NIP-46 responses (`#p = clientPubkey`) and wait for EOSE.
 *   4. Publish `get_public_key`.
 *   5. Hope Primal's bunker subscription is also live on the same relay at
 *      that exact moment.
 *
 * Doing all of that inline behind the user's "Publish" click is what makes
 * the first sign feel broken until they click "New Session" + restart Primal.
 *
 * This module mirrors what Ditto does in `NostrProvider.tsx`: the moment the
 * app mounts and a NIP-46 login is present, eagerly construct the signer
 * bound to the shared pool so the bunker REQ subscription is live before any
 * user action. We deliberately do NOT proactively `ping()` the bunker  -  that
 * was a leftover from the old shaky implementation. The first real sign call
 * will discover liveness on its own and the existing retry/reconnect layer
 * handles failure.
 *
 * Best-effort throughout  -  boot-time failures are swallowed; the user-driven
 * sign path still has its own reconnect-and-retry layer.
 */

import { getSharedPool } from "~/features/nostr/shared-pool.client";

import {
  PENDING_NIP46_STORAGE_KEY,
  readPendingNip46Handoff,
} from "../pending-nip46-storage.client";

import { getActiveSigner } from "./nostr-signer-connection.client";
import { getActiveSignerConfig } from "./nostr-signer-storage.client";

let bootstrapStarted = false;

/**
 * Run the boot-time signer warm-up exactly once per page load.
 *
 * Always opens the shared pool so its `enableReconnect`/`enablePing` defenses
 * are armed. If a NIP-46 config is persisted, also resolves a signer from it
 * (which subscribes the bunker REQ + runs `get_public_key`) so the next user
 * sign is a single round-trip on a warm channel rather than a cold-boot dance.
 *
 * Safe to call from React effects and from outside React; subsequent calls
 * are no-ops.
 */
export function bootstrapNostrSigner(): void {
  if (bootstrapStarted) return;
  bootstrapStarted = true;
  if (typeof window === "undefined") return;

  // Always warm the shared pool so the first WebSocket has time to open in
  // the background, even for users who have no NIP-46 config yet.
  try {
    getSharedPool();
  } catch {
    // ignore
  }

  // If a pending NIP-46 handoff is in flight (we just came back from the
  // signer app's deep-link callback and are about to call `resume()`), do
  // NOT reconstruct a signer from any leftover stored config. The stored
  // config's `clientSecretKey` is from a PREVIOUS session and the remote
  // signer no longer recognizes it (each `createNip46NostrConnectUri` call
  // mints a fresh key, and the signer binds to the latest one when it
  // approves the URI). Bootstrapping anyway constructs a parallel
  // `Nip46Signer` whose RPCs the bunker silently discards (it can't
  // derive the conversation key) and whose subscription competes with
  // the fresh login's subscription on the shared pool, corrupting the
  // listener bag and making the legitimate `get_public_key` time out.
  // The login flow will install the right signer with the right key and
  // `persistNip46LoginSession` will overwrite the stale config.
  if (readPendingNip46Handoff(PENDING_NIP46_STORAGE_KEY) !== null) return;

  const config = getActiveSignerConfig();
  if (config?.type !== "nip46") return;

  void (async () => {
    try {
      await getActiveSigner({ allowReconnect: true });
    } catch {
      // Best-effort: the user-driven sign path has its own reconnect layer.
    }
  })();
}

/**
 * Test-only: reset the "ran once" guard so unit tests can re-exercise the
 * bootstrap. Do not call from product code.
 */
export function __resetBootstrapForTests(): void {
  bootstrapStarted = false;
}
