/**
 * App-lifetime shared `SimplePool` for the NIP-46 signer.
 *
 * Why one pool:
 * - `nostr-tools`' `SimplePool` is the unit that owns relay sockets and
 *   resubscriptions; recreating it forces every BunkerSigner to re-open
 *   WebSockets and re-issue REQs.
 * - With `enableReconnect: true` + `enablePing: true`, this pool self-heals
 *   sockets when the page suspends/resumes, so we never want to throw it away.
 * - Every NIP-46 entry point (initial connect, reconnect, failover, background
 *   reconnect) routes through this so the bunker subscription is rebuilt
 *   without disturbing transport.
 *
 * Lifetime: created lazily on first call, never closed for the life of the
 * page. The signer-side `close()` only closes the per-bunker subscription.
 */

import { SimplePool } from "nostr-tools";

let _pool: SimplePool | null = null;

export function getSharedPool(): SimplePool {
  _pool ??= new SimplePool({ enableReconnect: true, enablePing: true });
  return _pool;
}

/**
 * Test-only: drop the cached pool so unit tests can start from a clean state.
 * Do NOT call this from product code.
 */
export function __resetSharedPoolForTests(): void {
  _pool = null;
}
