import type { SimplePool } from "nostr-tools";
import { generateSecretKey, getPublicKey } from "nostr-tools";
import { decrypt as nip44Decrypt } from "nostr-tools/nip44";
import {
  BunkerSigner,
  createNostrConnectURI,
  parseBunkerInput,
} from "nostr-tools/nip46";

import { getSharedPool } from "~/features/nostr/shared-pool.client";
import type { NostrEvent, SignedEvent } from "~/features/nostr/types";
import { BRAND_NAME, brandLoginChallengeTitle } from "~/lib/brand";

export type NostrSignerType = "nip07" | "nip46";

export type SignerStatus =
  | "unavailable"
  | "available"
  | "awaiting_approval"
  | "ready"
  | "error";

export interface NostrSigner {
  type: NostrSignerType;
  getPublicKey(): Promise<string>;
  signEvent(event: NostrEvent): Promise<SignedEvent>;
  /**
   * NIP-04 encrypt for the signing identity toward `thirdPartyPubkeyHex` (peer hex).
   * NIP-07: `window.nostr.nip04`. NIP-46: bunker `nip04_encrypt` RPC.
   */
  nip04Encrypt(thirdPartyPubkeyHex: string, plaintext: string): Promise<string>;
  /**
   * NIP-44 encrypt for the signing identity toward `thirdPartyPubkeyHex` (peer hex).
   * NIP-07: optional `window.nostr.nip44`. NIP-46: bunker `nip44_encrypt` RPC.
   */
  nip44Encrypt(thirdPartyPubkeyHex: string, plaintext: string): Promise<string>;
  getStatus(): SignerStatus;
  ping?(): Promise<void>;
  switchRelays?(): Promise<string[] | null>;
  close?(): Promise<void>;
}

export class Nip07Signer implements NostrSigner {
  public readonly type = "nip07" as const;

  getStatus(): SignerStatus {
    return typeof window !== "undefined" && window.nostr
      ? "available"
      : "unavailable";
  }

  async getPublicKey(): Promise<string> {
    if (!window.nostr) {
      throw new Error("SIGNER_NOT_FOUND");
    }
    return await window.nostr.getPublicKey();
  }

  async signEvent(event: NostrEvent): Promise<SignedEvent> {
    if (!window.nostr) {
      throw new Error("SIGNER_NOT_FOUND");
    }
    const signed = await window.nostr.signEvent(event);
    return signed as SignedEvent;
  }

  async nip04Encrypt(
    thirdPartyPubkeyHex: string,
    plaintext: string
  ): Promise<string> {
    if (!window.nostr?.nip04?.encrypt) {
      throw new Error(
        "NIP-04 encryption is not available. Enable NIP-04 in your browser extension."
      );
    }
    return await window.nostr.nip04.encrypt(thirdPartyPubkeyHex, plaintext);
  }

  async nip44Encrypt(
    thirdPartyPubkeyHex: string,
    plaintext: string
  ): Promise<string> {
    if (!window.nostr?.nip44?.encrypt) {
      throw new Error(
        "NIP-44 encryption is not available in your extension (optional NIP-07)."
      );
    }
    return await window.nostr.nip44.encrypt(thirdPartyPubkeyHex, plaintext);
  }
}

export interface Nip46ConnectResult {
  signer: Nip46Signer;
  pubkey: string;
}

export type Nip46ConnectionMethod = "bunker_input" | "nostrconnect_uri";

/**
 * Per-RPC timeouts for the bunker. `BunkerSigner.sendRequest` itself has no
 * timeout: a never-arriving reply leaks a listener forever and the next sign
 * call also hangs. Bounding each call here prevents that and gives the outer
 * adapter a clean error to act on.
 *
 * `signEvent` and `getPublicKey` are deliberately generous because in real
 * use a remote signer (Primal, Amber, etc.) often runs on a phone that has
 * been backgrounded. The first request after the app reopens has to wait for
 * the OS to wake the signer app, the signer app to reconnect to its relay,
 * and the user to tap "approve" on a notification. A short timeout here
 * surfaces as "the post timed out" even though the bunker would have signed
 * it ten seconds later. Ditto/`@nostrify` `NConnectSigner` defaults to no
 * timeout at all; we keep one as a safety net but bias it toward the real
 * mobile-wake-up budget.
 */
const NIP46_RPC_TIMEOUTS = {
  signEvent: 60_000,
  getPublicKey: 30_000,
  nip04Encrypt: 30_000,
  nip44Encrypt: 30_000,
  ping: 10_000,
  switchRelays: 8_000,
} as const;

/** NIP-46 / Nostr Connect kind. */
const NOSTR_CONNECT_KIND = 24_133;

/**
 * Upper bound on how long the per-RPC subscription pre-warm will wait for
 * EOSE before publishing the EVENT anyway. Real relays return EOSE for an
 * empty filter in ~50–250 ms; this 5 s ceiling exists purely so a stalled
 * relay can't hang every signing call.
 */
const REQ_READY_TIMEOUT_MS = 5_000;

/* ------------------------------------------------------------------------ */
/*                       NIP-46 diagnostic logging                          */
/* ------------------------------------------------------------------------ */
/*
 * TEMPORARY: always-on browser-side log of every NIP-46 EVENT, OK ack, REQ
 * subscription, EOSE, CLOSED, and dispatched event. Used to capture wire-
 * level evidence for the iOS-Safari cold-reopen sign timeout bug. Open
 * Safari Web Inspector (Develop → <iPhone> → <SmartFlowSocial>), filter
 * console for `[nip46`, reproduce the bug, then send the captured log.
 *
 * Gated on `typeof window` so vitest (node env) stays silent. Remove the
 * `nip46log`, `createLoggingPool`, and their call sites once the underlying
 * bug is identified and fixed. Search for `[nip46-diag]` to find every
 * touch point.
 */

/* eslint-disable no-console -- diagnostic logging, see block comment above */

function nip46log(label: string, data?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  const ts = new Date().toISOString().slice(11, 23);
  if (data === undefined) {
    console.log(`[nip46 ${ts}] ${label}`);
  } else {
    console.log(`[nip46 ${ts}] ${label}`, data);
  }
}

interface PublishableEvent {
  id: string;
  kind: number;
  pubkey: string;
  created_at: number;
  tags: string[][];
  content: string;
}

/**
 * [nip46-diag] Wraps a `SimplePool` so every `publish()` call emits a log
 * line for the EVENT going out plus per-relay OK / FAIL acks. Returns a
 * Proxy; everything except `publish` is forwarded unchanged. Diagnostic
 * only — see block comment above `nip46log`.
 */
function createLoggingPool(pool: SimplePool, label: string): SimplePool {
  if (typeof window === "undefined") return pool;
  return new Proxy(pool, {
    get(target, prop, receiver) {
      if (prop === "publish") {
        return (relays: string[], event: PublishableEvent) => {
          nip46log(`${label} publish`, {
            eventId: event.id,
            kind: event.kind,
            createdAt: event.created_at,
            tags: event.tags,
            contentLen: event.content.length,
            relays,
          });
          const publishFn = (
            target as unknown as {
              publish: (
                r: string[],
                e: PublishableEvent
              ) => Array<Promise<string>>;
            }
          ).publish;
          const promises = publishFn.call(target, relays, event);
          promises.forEach((p, i) => {
            const relay = relays[i] ?? "?";
            void (async () => {
              try {
                const reason = await p;
                nip46log(`${label} publish-ok`, {
                  eventId: event.id,
                  relay,
                  reason,
                });
              } catch (err: unknown) {
                nip46log(`${label} publish-fail`, {
                  eventId: event.id,
                  relay,
                  error: err instanceof Error ? err.message : String(err),
                });
              }
            })();
          });
          return promises;
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

/* eslint-enable no-console */

/**
 * Wraps a `SimplePool` so every `publish()` call goes to a SINGLE relay
 * (the "bunker primary"), instead of fanning the EVENT out to every relay
 * in `bp.relays`.
 *
 * Why this exists:
 *
 * - `nostr-tools`' `BunkerSigner.sendRequest` calls `pool.publish(this.bp.relays, evt)`.
 *   For nostrconnect URIs we generate, `bp.relays` contains 3 default relays
 *   (`relay.primal.net`, `relay.damus.io`, `nos.lol/`). The bunker app
 *   (e.g. Primal on iOS) only listens on its own home relay.
 *
 * - When we publish the same EVENT to all 3 relays, the bunker can see two
 *   non-canonical copies (forwarded via cross-relay gossip / shared client
 *   subscriptions) before its own relay's copy arrives. Some bunker
 *   implementations dedupe by event id and silently drop subsequent copies,
 *   which means the EVENT they actually see can be one they choose to
 *   ignore — and they never reply. The handshake (`connect`) tolerates this
 *   because the URI's secret-matching window only needs *some* matching
 *   event; per-RPC `get_public_key` / `sign_event` does not.
 *
 * - `@nostrify/nostrify`'s `NConnectSigner` (used by Ditto) takes a single
 *   `NRelay`, so it never has this fan-out problem. We mirror that here by
 *   restricting publish to one relay, while keeping subscribe across all
 *   relays as a safety net for receiving responses.
 *
 * Subscribe and every other method are forwarded unchanged.
 */
function createBunkerPublishPool(
  pool: SimplePool,
  primaryRelay: () => string | undefined,
  label: string
): SimplePool {
  return new Proxy(pool, {
    get(target, prop, receiver) {
      if (prop === "publish") {
        return (relays: string[], event: PublishableEvent) => {
          const primary = primaryRelay();
          const targetRelays =
            primary && relays.includes(primary)
              ? [primary]
              : relays.length > 0
                ? [relays[0]!]
                : relays;
          if (
            typeof window !== "undefined" &&
            targetRelays.length !== relays.length
          ) {
            nip46log(`${label} publish-restricted`, {
              eventId: event.id,
              from: relays,
              to: targetRelays,
            });
          }
          const publishFn = (
            target as unknown as {
              publish: (
                r: string[],
                e: PublishableEvent
              ) => Array<Promise<string>>;
            }
          ).publish;
          return publishFn.call(target, targetRelays, event);
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

/**
 * Decoded NIP-46 response payload. `result === "auth_url"` is a transient
 * notification (the bunker is asking the user to approve via `error` URL),
 * not the final response, so the listener stays in place until the real
 * `result` or `error` arrives.
 */
interface BunkerResponseEnvelope {
  id: string;
  result?: string;
  error?: string;
}

/**
 * Internal shape of `nostr-tools` `BunkerSigner` we touch for the per-RPC
 * subscription pre-warm. Kept narrow so a future upstream change shows up as
 * a compile error instead of a silent runtime miss.
 *
 * `listeners` and `waitingForAuth` are bag objects shared across every
 * subscription the bunker opens, so swapping `subCloser` for one we
 * constructed ourselves keeps the bunker's own RPC dispatch working.
 */
interface BunkerSignerInternals {
  subCloser?: { close: (reason?: string) => Promise<void> | void };
  isOpen: boolean;
  listeners: Record<
    string,
    { resolve: (value: string) => void; reject: (err: unknown) => void }
  >;
  waitingForAuth: Record<string, boolean>;
  conversationKey: Uint8Array;
  secretKey: Uint8Array;
  bp: { pubkey: string; relays: string[]; secret: null | string };
  params?: { onauth?: (url: string) => void };
}

export class Nip46Signer implements NostrSigner {
  public readonly type = "nip46" as const;
  private readonly pool: SimplePool;
  private readonly inner: BunkerSigner;
  private status: SignerStatus = "available";
  /**
   * Serializes RPCs against the inner `BunkerSigner` so the per-RPC
   * subscription refresh below cannot drop a reply that belongs to a
   * concurrent in-flight request. In practice the composer signs one event
   * at a time, so the lock is uncontended; this is purely defensive.
   */
  private rpcLock: Promise<unknown> = Promise.resolve();

  /** [nip46-diag] short-id label for log lines, see block comment above. */
  private readonly diagLabel: string;

  /**
   * Explicit override for the relay that NIP-46 EVENTs are published to.
   * When unset, the wrapper defaults to `bp.relays[0]` (the first relay
   * declared in the bunker URI / pointer, which by convention is the
   * bunker app's home relay).
   */
  private bunkerPublishRelay: string | undefined;

  constructor(input: {
    pool: SimplePool;
    inner: BunkerSigner;
    /**
     * Optional explicit override for the relay every NIP-46 EVENT is
     * published to. See `createBunkerPublishPool` for the rationale.
     */
    bunkerPublishRelay?: string;
  }) {
    this.pool = input.pool;
    this.inner = input.inner;
    this.bunkerPublishRelay = input.bunkerPublishRelay;

    // The `bp`/`pool` accesses are guarded with optional chaining because
    // some unit tests construct Nip46Signer with a partial `inner` mock that
    // doesn't populate the BunkerSigner internals. In production both
    // fields are always set by the time `Nip46Signer` is constructed
    // (fromBunker/fromURI sets them before returning).
    const innerForDiag = this.inner as unknown as Partial<
      BunkerSignerInternals & { pool: SimplePool }
    >;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- BunkerSignerInternals types pubkey as string, but unit-test partial mocks set bp = {} with no pubkey, so the runtime guard is needed.
    const bunkerShortId = innerForDiag.bp?.pubkey?.slice(0, 8) ?? "????????";
    this.diagLabel = `signer:${bunkerShortId}`;
    nip46log(`${this.diagLabel} created`, {
      bunkerPubkey: innerForDiag.bp?.pubkey,
      relays: innerForDiag.bp?.relays,
      bunkerPublishRelay: this.bunkerPublishRelay,
    });
    if (innerForDiag.pool) {
      // Order matters: restrict publish FIRST (so the logging wrapper logs
      // the actually-restricted relay list), then add diagnostic logging.
      // The publish restriction always runs (it's the actual behaviour
      // change). The logging wrapper is browser-only.
      const restricted = createBunkerPublishPool(
        innerForDiag.pool,
        () => this.bunkerPublishRelay ?? innerForDiag.bp?.relays[0],
        this.diagLabel
      );
      innerForDiag.pool = createLoggingPool(restricted, this.diagLabel);
    }
  }

  /**
   * Override the relay used for publishing NIP-46 EVENTs. Pass `undefined`
   * to fall back to `bp.relays[0]`. Useful for failover scenarios where the
   * caller has external evidence that the primary relay is unhealthy.
   */
  setBunkerPublishRelay(relay: string | undefined): void {
    this.bunkerPublishRelay = relay;
    nip46log(`${this.diagLabel} publish-relay-set`, { relay });
  }

  getStatus(): SignerStatus {
    return this.status;
  }

  setStatus(next: SignerStatus): void {
    this.status = next;
  }

  /**
   * Open a fresh REQ subscription on the bunker relays so that the next RPC's
   * EVENT publish is guaranteed to be sent AFTER the REQ on the same WebSocket
   * AND after the relay has acknowledged the REQ with EOSE.
   *
   * Why this exists:
   *
   * - `nostr-tools`' `BunkerSigner.sendRequest` calls `pool.subscribe(...)`
   *   and `pool.publish(...)` in the same tick. Both go through `ensureRelay`
   *   and then `relay.send(...)`, which is async via `connectionPromise.then`.
   *   Without an explicit barrier between them, the EVENT microtask can land
   *   on the wire before the REQ microtask and the relay forwards the bunker
   *   reply to a subscription that does not exist yet.
   *
   * - We additionally wait for EOSE so the response (which arrives on the
   *   *original* `subCloser` from `BunkerSigner.setupSubscription`, since
   *   most relays broadcast to the first matching subscription only) is not
   *   delivered to a sub the relay considers stale. The cost is ~200 ms per
   *   RPC, which is negligible compared to the bunker's own round-trip and
   *   far below any UX-visible threshold.
   *
   * What we do here:
   *
   * 1. Close any existing `subCloser` (the construction-time one or the one
   *    left over from the previous RPC).
   * 2. Open our own `pool.subscribe` with the same filter `BunkerSigner`
   *    uses; the `onevent` decrypts and dispatches into
   *    `BunkerSigner.listeners` exactly the way the bunker's own subscription
   *    would, so the bunker's RPC dispatch keeps working unchanged.
   * 3. Hand the resulting closer to the bunker via `inner.subCloser`. When
   *    `BunkerSigner.sendRequest` runs next, it sees `subCloser` is already
   *    set and skips its own `setupSubscription()`, so it goes straight to
   *    publishing the EVENT.
   * 4. Wait for EOSE (with a short timeout) before returning so the EVENT
   *    publish that follows is guaranteed to land after the relay has the
   *    sub registered for real-time forwarding.
   */
  private async refreshBunkerSubscription(): Promise<void> {
    const inner = this.inner as unknown as BunkerSignerInternals;
    if (!inner.isOpen) return;

    const oldCloser = inner.subCloser;
    inner.subCloser = undefined;
    if (oldCloser) {
      nip46log(`${this.diagLabel} sub:close-prev`);
      try {
        await oldCloser.close("nip46:per-rpc-refresh");
      } catch {
        // best-effort close
      }
    }

    const clientPubkey = getPublicKey(inner.secretKey);
    const convKey = inner.conversationKey;
    const listeners = inner.listeners;
    const waitingForAuth = inner.waitingForAuth;
    const onauth = inner.params?.onauth;
    const diagLabel = this.diagLabel;
    nip46log(`${diagLabel} sub:open`, {
      relays: inner.bp.relays,
      filter: {
        kinds: [NOSTR_CONNECT_KIND],
        authors: [inner.bp.pubkey],
        "#p": [clientPubkey],
      },
    });

    let resolveReady: () => void = () => {
      // assigned synchronously below
    };
    const ready = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });

    const closer = this.pool.subscribe(
      inner.bp.relays,
      {
        kinds: [NOSTR_CONNECT_KIND],
        authors: [inner.bp.pubkey],
        "#p": [clientPubkey],
      },
      {
        onevent: (event: { content: string; pubkey?: string; id?: string }) => {
          let decoded: BunkerResponseEnvelope;
          try {
            const plaintext = nip44Decrypt(event.content, convKey);
            decoded = JSON.parse(plaintext) as BunkerResponseEnvelope;
          } catch (err) {
            nip46log(`${diagLabel} sub:event-decrypt-fail`, {
              eventId: event.id,
              eventPubkey: event.pubkey,
              error: err instanceof Error ? err.message : String(err),
            });
            return;
          }
          const { id, result, error } = decoded;
          nip46log(`${diagLabel} sub:event`, {
            relayEventId: event.id,
            rpcId: id,
            result:
              typeof result === "string" ? result.slice(0, 64) : undefined,
            error: typeof error === "string" ? error.slice(0, 80) : undefined,
            knownListener: id ? Boolean(listeners[id]) : false,
          });
          if (!id) return;

          if (result === "auth_url" && waitingForAuth[id]) {
            delete waitingForAuth[id];
            if (onauth && typeof error === "string") {
              try {
                onauth(error);
              } catch {
                // ignore: we don't propagate signer-app callback errors
              }
            }
            return;
          }

          const handler = listeners[id];
          if (!handler) return;
          if (error) {
            handler.reject(error);
          } else if (typeof result === "string") {
            handler.resolve(result);
          }
          delete listeners[id];
        },
        oneose: () => {
          nip46log(`${diagLabel} sub:eose`);
          resolveReady();
        },
        onclose: (reasons: string[]) => {
          nip46log(`${diagLabel} sub:close`, { reasons });
          // Mirror BunkerSigner's own onclose so it sees the sub is gone
          // (e.g. relay-initiated close) and rebuilds on the next RPC.
          if (inner.subCloser === closer) {
            inner.subCloser = undefined;
          }
          // Unblock the EOSE wait below if the sub closed before EOSE arrived
          // (e.g. relay rejected the REQ); the publish will then proceed and
          // either succeed against another relay or fail with a useful error.
          resolveReady();
        },
      }
    );

    inner.subCloser = closer;
    inner.isOpen = true;

    // Bound the wait so a slow/dead relay can't stall every RPC. If EOSE
    // never arrives we still proceed; the publish has its own per-relay
    // timeout in `nostr-tools` and the bunker subscription stays open in
    // the background.
    await Promise.race([
      ready,
      new Promise<void>((resolve) => setTimeout(resolve, REQ_READY_TIMEOUT_MS)),
    ]);
  }

  private async rpc<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    label: string
  ): Promise<T> {
    const previous = this.rpcLock;
    let release: () => void = () => {
      // no-op until the lock-arming Promise constructor below assigns the
      // real resolver; satisfies @typescript-eslint without a useless undefined.
    };
    this.rpcLock = new Promise<void>((resolve) => {
      release = resolve;
    });
    const startedAt = Date.now();
    nip46log(`${this.diagLabel} rpc:start`, { method: label, timeoutMs });
    try {
      await previous.catch(() => {
        // Swallow upstream rejections so one failed RPC doesn't poison the
        // lock for the next caller.
      });
      await this.refreshBunkerSubscription();
      let to: ReturnType<typeof setTimeout> | undefined;
      try {
        const result = await Promise.race([
          fn(),
          new Promise<never>((_, reject) => {
            to = setTimeout(
              () => reject(new Error(`bunker:${label} timeout`)),
              timeoutMs
            );
          }),
        ]);
        nip46log(`${this.diagLabel} rpc:done`, {
          method: label,
          ms: Date.now() - startedAt,
        });
        return result;
      } catch (err) {
        nip46log(`${this.diagLabel} rpc:error`, {
          method: label,
          ms: Date.now() - startedAt,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      } finally {
        if (to) clearTimeout(to);
      }
    } finally {
      release();
    }
  }

  async getPublicKey(): Promise<string> {
    this.status = "ready";
    return await this.rpc(
      () => this.inner.getPublicKey(),
      NIP46_RPC_TIMEOUTS.getPublicKey,
      "get_public_key"
    );
  }

  async signEvent(event: NostrEvent): Promise<SignedEvent> {
    this.status = "ready";
    return (await this.rpc(
      () => this.inner.signEvent(event),
      NIP46_RPC_TIMEOUTS.signEvent,
      "sign_event"
    )) as SignedEvent;
  }

  async nip04Encrypt(
    thirdPartyPubkeyHex: string,
    plaintext: string
  ): Promise<string> {
    this.status = "ready";
    return await this.rpc(
      () => this.inner.nip04Encrypt(thirdPartyPubkeyHex, plaintext),
      NIP46_RPC_TIMEOUTS.nip04Encrypt,
      "nip04_encrypt"
    );
  }

  async nip44Encrypt(
    thirdPartyPubkeyHex: string,
    plaintext: string
  ): Promise<string> {
    this.status = "ready";
    return await this.rpc(
      () => this.inner.nip44Encrypt(thirdPartyPubkeyHex, plaintext),
      NIP46_RPC_TIMEOUTS.nip44Encrypt,
      "nip44_encrypt"
    );
  }

  async ping(): Promise<void> {
    this.status = "ready";
    await this.rpc(() => this.inner.ping(), NIP46_RPC_TIMEOUTS.ping, "ping");
  }

  async switchRelays(): Promise<string[] | null> {
    this.status = "ready";
    const response = await this.rpc(
      () => this.inner.sendRequest("switch_relays", []),
      NIP46_RPC_TIMEOUTS.switchRelays,
      "switch_relays"
    );
    if (response === "null") {
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(response) as unknown;
    } catch {
      return null;
    }
    if (!Array.isArray(parsed)) {
      return null;
    }

    const normalized = parsed
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter((relay) => relay.startsWith("wss://"));

    if (normalized.length === 0) {
      return null;
    }

    return Array.from(new Set(normalized));
  }

  /**
   * Returns the stored BunkerPointer (pubkey, relays, secret) for persisting
   * so reconnects can use Method 1 (fromBunker) with the exact pointer shape.
   */
  getBunkerPointer(): {
    pubkey: string;
    relays: string[];
    secret: null | string;
  } {
    const bp = this.inner.bp;
    return {
      pubkey: bp.pubkey,
      relays: [...bp.relays],
      secret: bp.secret,
    };
  }

  async close(): Promise<void> {
    // Only release the bunker subscription. The pool is shared with the rest
    // of the app and self-heals its sockets, so closing relays here would
    // tear down transport for every other component (and force the next
    // signer to re-open WebSockets before it can RPC).
    //
    // `BunkerSigner.close` assumes `subCloser` is defined and crashes
    // otherwise; our per-RPC refresh leaves it `undefined` between RPCs.
    // Inline its safe portion (flip `isOpen`, close the sub if any) instead
    // of letting it throw.
    nip46log(`${this.diagLabel} signer:close`);
    const inner = this.inner as unknown as BunkerSignerInternals;
    inner.isOpen = false;
    const closer = inner.subCloser;
    inner.subCloser = undefined;
    if (closer) {
      try {
        await closer.close("nip46:signer-close");
      } catch {
        // best-effort
      }
    }
  }
}

export function canonicalLoginMessage(input: {
  nonce: string;
  expiresAtIso: string;
}): string {
  return [
    brandLoginChallengeTitle,
    "",
    `Nonce: ${input.nonce}`,
    "Purpose: login",
    `Expires: ${input.expiresAtIso}`,
  ].join("\n");
}

export { parseRelayList } from "./parse-relay-list";

/** App URL and icon URL for NIP-46 metadata so signers (e.g. Primal) can show our app name and icon. Client-only. */
export function getNostrConnectAppMetadata(): {
  appUrl?: string;
  appIconUrl?: string;
} {
  if (typeof window === "undefined") return {};
  const origin = window.location.origin;
  return {
    appUrl: origin,
    appIconUrl: `${origin}/apple-touch-icon.png`,
  };
}

/**
 * Calculate progressive timeout for NIP-46 connections
 * Reduces timeout on retries to fail faster
 */
function getProgressiveConnectionTimeout(retryCount: number): number {
  const baseTimeout = 120_000; // 2 minutes for first attempt
  if (retryCount === 0) return baseTimeout;
  const timeout = baseTimeout / Math.pow(2, retryCount);
  return Math.max(timeout, 30_000); // Minimum 30 seconds
}

export function createNip46NostrConnectUri(input: {
  relays: string[];
  appName?: string;
  /** App URL for NIP-46 metadata (e.g. https://smartflowsocial.com). Primal shows this and uses it with the icon. */
  appUrl?: string;
  /** Absolute URL to app icon (e.g. https://smartflowsocial.com/apple-touch-icon.png). Shown in Primal Connected Apps. */
  appIconUrl?: string;
}): {
  uri: string;
  clientSecretKey: Uint8Array;
  pool: SimplePool;
  relays: string[];
} {
  const clientSecretKey = generateSecretKey();
  const pool = getSharedPool();
  const clientPubkey = getPublicKey(clientSecretKey);
  const secret =
    Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

  const uri = createNostrConnectURI({
    clientPubkey,
    relays: input.relays,
    secret,
    name: input.appName ?? BRAND_NAME,
    ...(input.appUrl && { url: input.appUrl }),
    ...(input.appIconUrl && { image: input.appIconUrl }),
  });

  return { uri, clientSecretKey, pool, relays: input.relays };
}

export async function connectNip46WithBunkerInput(input: {
  bunkerInput: string;
  pool?: SimplePool;
  clientSecretKey?: Uint8Array;
  timeoutMs: number;
  retryCount?: number;
  /** When true, skip connect() (reconnect from stored config per nostr-tools docs). */
  skipConnect?: boolean;
  /**
   * When true, skip the `getPublicKey()` validation round-trip and return
   * the bunker pubkey from `parseBunkerInput`. Use on cold rebuild from
   * stored config: the original login already validated this bunker, and
   * doing a second RPC here just races the user's first `signEvent` for the
   * bunker's reply. Mirrors `@nostrify` `NConnectSigner` which never does a
   * "validate" call on construction.
   */
  skipValidation?: boolean;
  /** Override relays from bunkerInput (e.g. from switch_relays response). */
  relays?: string[];
}): Promise<Nip46ConnectResult> {
  const clientSecretKey = input.clientSecretKey ?? generateSecretKey();
  const pool = input.pool ?? getSharedPool();

  const bp = await parseBunkerInput(input.bunkerInput);
  if (!bp) {
    throw new Error("Invalid bunker input");
  }
  const effectiveRelays =
    (input.relays?.length ?? 0) > 0
      ? input.relays!.map((r) => r.trim()).filter((r) => r.startsWith("wss://"))
      : bp.relays;
  const bpToUse =
    effectiveRelays.length > 0 ? { ...bp, relays: effectiveRelays } : bp;
  const inner = BunkerSigner.fromBunker(clientSecretKey, bpToUse, { pool });

  const timeoutMs =
    input.retryCount !== undefined
      ? getProgressiveConnectionTimeout(input.retryCount)
      : input.timeoutMs;
  const timeout = new Promise<never>((_resolve, reject) =>
    setTimeout(() => reject(new Error("SIGNER_TIMEOUT")), timeoutMs)
  );

  if (!input.skipConnect) {
    await Promise.race([inner.connect(), timeout]);
  }

  const signer = new Nip46Signer({ pool, inner });
  signer.setStatus("ready");
  if (input.skipValidation) {
    return { signer, pubkey: bp.pubkey };
  }
  const pubkey = await Promise.race([signer.getPublicKey(), timeout]);

  return { signer, pubkey };
}

export async function connectNip46WithNostrConnectUri(input: {
  uri: string;
  clientSecretKey: Uint8Array;
  pool: SimplePool;
  timeoutMs: number;
  relaysToCloseOnCancel: string[];
  retryCount?: number;
}): Promise<Nip46ConnectResult> {
  // Use progressive timeout if retryCount is provided, otherwise use provided timeoutMs
  const timeoutMs =
    input.retryCount !== undefined
      ? getProgressiveConnectionTimeout(input.retryCount)
      : Math.max(1_000, input.timeoutMs);

  const inner = await BunkerSigner.fromURI(
    input.clientSecretKey,
    input.uri,
    { pool: input.pool },
    timeoutMs
  );

  const signer = new Nip46Signer({ pool: input.pool, inner });
  signer.setStatus("ready");
  const pubkey = await signer.getPublicKey();
  return { signer, pubkey };
}

/** Serializable BunkerPointer shape for persisting and reconnecting. */
export interface StoredBunkerPointer {
  pubkey: string;
  relays: string[];
  secret: null | string;
}

/**
 * Reconnect using Method 1 (fromBunker, no connect) per nostr-tools docs.
 * Use when we have stored signer pubkey + relays (or full bunkerPointer) from a previous nostrconnect connection.
 */
export async function connectNip46ReconnectWithStoredNostrConnect(input: {
  clientSecretKey: Uint8Array;
  /** Use when no bunkerPointer is stored (backward compat). */
  signerPubkey?: string;
  relays: string[];
  /** When present, use this for fromBunker instead of reconstructing from signerPubkey + relays. */
  bunkerPointer?: StoredBunkerPointer;
  pool?: SimplePool;
  timeoutMs?: number;
  /**
   * When true, skip the `getPublicKey()` validation round-trip and return
   * the stored signer pubkey instead. See `connectNip46WithBunkerInput` for
   * the same rationale.
   */
  skipValidation?: boolean;
}): Promise<Nip46ConnectResult> {
  const pool = input.pool ?? getSharedPool();
  const bp: StoredBunkerPointer = input.bunkerPointer
    ? {
        pubkey: input.bunkerPointer.pubkey,
        relays: input.bunkerPointer.relays
          .map((r) => r.trim())
          .filter((r) => r.startsWith("wss://")),
        secret: input.bunkerPointer.secret,
      }
    : {
        pubkey: input.signerPubkey!,
        relays: input.relays
          .map((r) => r.trim())
          .filter((r) => r.startsWith("wss://")),
        secret: null,
      };
  if (bp.relays.length === 0 && input.relays.length > 0) {
    bp.relays = input.relays.map((r) => r.trim());
  }
  if (!bp.pubkey) {
    throw new Error(
      "connectNip46ReconnectWithStoredNostrConnect: signerPubkey or bunkerPointer required"
    );
  }
  const inner = BunkerSigner.fromBunker(input.clientSecretKey, bp, { pool });
  const signer = new Nip46Signer({ pool, inner });
  signer.setStatus("ready");
  if (input.skipValidation) {
    return { signer, pubkey: bp.pubkey };
  }
  const timeoutMs = input.timeoutMs ?? 15_000;
  const timeout = new Promise<never>((_resolve, reject) =>
    setTimeout(() => reject(new Error("SIGNER_TIMEOUT")), timeoutMs)
  );
  const pubkey = await Promise.race([signer.getPublicKey(), timeout]);
  return { signer, pubkey };
}
