import type { SimplePool } from "nostr-tools";
import { generateSecretKey, getPublicKey } from "nostr-tools";
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

/* ------------------------------------------------------------------------ */
/*                       NIP-46 diagnostic logging                          */
/* ------------------------------------------------------------------------ */
/*
 * Always-on browser-side log of every NIP-46 EVENT publish + per-relay OK /
 * FAIL ack and per-RPC start/done/error timing. Open Safari Web Inspector
 * (Develop → <iPhone> → <SmartFlowSocial>), filter console for `[nip46`,
 * reproduce a bug, then send the captured log.
 *
 * We deliberately do NOT log received events or sub open/close: those used
 * to be wired through a per-RPC subscription this wrapper managed by hand,
 * which raced the relay and dropped Primal's `get_public_key` reply ~50 %
 * of the time on iOS Safari sign-in. The fix was to stop touching the
 * bunker subscription at all (see `BunkerSignerInternals` doc), which also
 * removed the only place we had hooks to log inbound events. We can read
 * the same information off the wire from Primal Signer's app log if we
 * need it again.
 *
 * Gated on `typeof window` so vitest (node env) stays silent.
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

/* ------------------------------------------------------------------------ */
/*                Bunker subscription EOSE barrier                          */
/* ------------------------------------------------------------------------ */

/**
 * Hard cap on how long we wait for relays to acknowledge our barrier REQ
 * before publishing the first NIP-46 EVENT anyway. Empty-filter EOSE
 * normally returns in ~50–250 ms. Five seconds is a generous ceiling that
 * still beats every per-RPC timeout above; if a relay can't EOSE in 5 s
 * the publish is going to fail with a useful error either way.
 */
const BUNKER_SUB_READY_TIMEOUT_MS = 5_000;

/**
 * Wait for the bunker subscription that `BunkerSigner.fromURI` /
 * `fromBunker` just opened to be fully registered on every relay before
 * the first NIP-46 RPC publishes its EVENT.
 *
 * Why this exists:
 *
 * `BunkerSigner.setupSubscription` calls `pool.subscribe(...)` and returns
 * synchronously. The actual REQ frame goes out via WebSocket on a
 * microtask (`relay.send` queues through `connectionPromise.then(...)`),
 * with NO guarantee that the relay has acknowledged the subscription
 * before we publish the first NIP-46 EVENT. NIP-46 events are ephemeral
 * (kind 24133) — if the bunker's reply arrives at the relay before the
 * relay has registered our REQ, the response is dropped, no replay, and
 * we time out 30 s later with `bunker:get_public_key timeout`. That's the
 * 50/50 iOS Safari sign-in failure we kept chasing.
 *
 * `fromURI` is even worse than `fromBunker`: it closes its connect-ACK
 * subscription and immediately opens a new (more restrictive) one inside
 * its `onevent` handler, then resolves the signer promise. The CLOSE,
 * the new REQ, and our EVENT all hit the wire in the same handful of ms.
 *
 * The fix: open a tiny dummy REQ on the same relays and await its EOSE.
 * WebSocket frames on a single connection are strictly ordered, and
 * `relay.send()` queues writes through `connectionPromise.then(...)` in
 * registration order, so the dummy REQ is guaranteed to land AFTER the
 * bunker REQ. EOSE on the dummy proves the bunker REQ has also been
 * processed by the relay and is forwarding matching events to us.
 *
 * Bounded by `BUNKER_SUB_READY_TIMEOUT_MS`; if a relay is too slow we
 * give up and let the publish proceed.
 *
 * Modeled on Ditto's `@nostrify` `NConnectSigner` which sidesteps this
 * race by registering its async-iterator listener BEFORE publishing every
 * RPC, on a single relay. We can't restructure `nostr-tools`'
 * `BunkerSigner.sendRequest` the same way without forking, but the EOSE
 * barrier achieves the same guarantee at the cost of one tiny extra REQ
 * during the very first signer construction.
 */
export async function awaitBunkerSubscriptionReady(
  pool: SimplePool,
  relays: string[],
  diagLabel = "signer:??"
): Promise<void> {
  if (typeof window === "undefined") return;
  if (relays.length === 0) return;

  const startedAt = Date.now();
  nip46log(`${diagLabel} sub-ready:start`, { relays });

  await new Promise<void>((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (reason: string) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      nip46log(`${diagLabel} sub-ready:done`, {
        ms: Date.now() - startedAt,
        reason,
      });
      resolve();
    };

    let closer: { close: (reason?: string) => Promise<void> | void };
    try {
      // Filter on a single all-zeroes id with limit:0 makes the relay
      // EOSE immediately without ever forwarding events to us. Cheapest
      // possible "is the previous REQ I sent now registered?" probe.
      closer = pool.subscribe(
        relays,
        { ids: ["0".repeat(64)], limit: 0 },
        {
          oneose: () => {
            try {
              void closer.close("nip46:sub-ready");
            } catch {
              // best-effort
            }
            finish("eose");
          },
          onclose: () => finish("closed"),
          maxWait: BUNKER_SUB_READY_TIMEOUT_MS,
        }
      );
    } catch (err) {
      nip46log(`${diagLabel} sub-ready:subscribe-throw`, {
        error: err instanceof Error ? err.message : String(err),
      });
      finish("subscribe-throw");
      return;
    }

    timer = setTimeout(() => {
      try {
        void closer.close("nip46:sub-ready-timeout");
      } catch {
        // best-effort
      }
      finish("timeout");
    }, BUNKER_SUB_READY_TIMEOUT_MS);
  });
}

/**
 * Narrow view of `nostr-tools` `BunkerSigner` internals we touch from this
 * wrapper. Kept narrow so a future upstream change shows up as a compile
 * error instead of a silent runtime miss.
 *
 * We deliberately do NOT touch `listeners`, `waitingForAuth`,
 * `conversationKey`, `secretKey`. Those are owned end-to-end by the
 * bunker's own `setupSubscription()` (called by `fromBunker`/`fromURI`
 * before they return), and our previous attempt to manage them by-hand
 * introduced a close-then-reopen race against the relay that lost Primal's
 * reply ~50 % of the time on iOS Safari sign-in. Ditto's `@nostrify`
 * `NConnectSigner` likewise leaves its single relay subscription alone for
 * the lifetime of the signer.
 *
 * We do read `subCloser` and `isOpen` solely from `close()` so the bunker
 * subscription is released when the user logs out or rebuilds — but we
 * never close+reopen it for an RPC.
 */
interface BunkerSignerInternals {
  isOpen: boolean;
  subCloser?: { close: (reason?: string) => Promise<void> | void };
  bp: { pubkey: string; relays: string[]; secret: null | string };
}

export class Nip46Signer implements NostrSigner {
  public readonly type = "nip46" as const;
  private readonly pool: SimplePool;
  private readonly inner: BunkerSigner;
  private status: SignerStatus = "available";
  /**
   * Serializes RPCs against the inner `BunkerSigner` so two concurrent
   * callers can't interleave their `sendRequest` IDs (BunkerSigner uses a
   * single shared `serial`) and confuse the listener dispatch. In practice
   * the composer signs one event at a time, so the lock is uncontended;
   * this is purely defensive.
   */
  private rpcLock: Promise<unknown> = Promise.resolve();

  /** [nip46-diag] short-id label for log lines, see block comment above. */
  private readonly diagLabel: string;

  constructor(input: { pool: SimplePool; inner: BunkerSigner }) {
    this.pool = input.pool;
    this.inner = input.inner;

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
    });
    if (innerForDiag.pool) {
      // Diagnostic logging only; we let `nostr-tools`' BunkerSigner publish
      // the EVENT to every relay in `bp.relays` exactly the way Ditto's
      // NConnectSigner does (`pool.group(login.data.relays)`). Single-relay
      // publish was tried and demonstrably broken Primal cold-reopen sign
      // because Primal's iOS bunker wakes up subscribed to whichever of
      // its 3 advertised relays its push pipeline picks; restricting our
      // EVENT to one relay can land it in the void from the bunker's POV.
      innerForDiag.pool = createLoggingPool(innerForDiag.pool, this.diagLabel);
    }
  }

  getStatus(): SignerStatus {
    return this.status;
  }

  setStatus(next: SignerStatus): void {
    this.status = next;
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
    // otherwise; the relay can legitimately call `onclose` (which clears
    // `subCloser`) before we get here, e.g. on a CLOSED frame. Inline the
    // safe portion (flip `isOpen`, close the sub if any) instead of letting
    // BunkerSigner.close throw.
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

  const signer = new Nip46Signer({ pool, inner });
  signer.setStatus("ready");

  // EOSE-barrier the bunker subscription that fromBunker just opened
  // before any RPC publishes its EVENT. See `awaitBunkerSubscriptionReady`
  // for why this is mandatory on iOS Safari.
  await awaitBunkerSubscriptionReady(
    pool,
    bpToUse.relays,
    `signer:${bpToUse.pubkey.slice(0, 8)}`
  );

  if (!input.skipConnect) {
    await Promise.race([inner.connect(), timeout]);
  }

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

  // fromURI closes its connect-ACK sub and opens a fresh, more restrictive
  // sub via setupSubscription IN THE SAME TICK as it resolves the signer
  // promise, then we publish get_public_key within ~2 ms. Without this
  // barrier the relay can forward Primal's reply before our REQ is
  // registered, and the ephemeral kind-24133 response is dropped. Optional
  // chaining covers test mocks that don't populate `bp`.
  const innerBp = (
    inner as unknown as { bp?: { relays?: string[]; pubkey?: string } }
  ).bp;
  if (innerBp?.relays?.length) {
    await awaitBunkerSubscriptionReady(
      input.pool,
      innerBp.relays,
      `signer:${innerBp.pubkey?.slice(0, 8) ?? "????????"}`
    );
  }

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

  // EOSE-barrier the bunker subscription before any RPC. See
  // `awaitBunkerSubscriptionReady`. Without this, the first
  // `getPublicKey()` after a cold rebuild can race the relay registering
  // our REQ and time out 30 s later with a dropped ephemeral response.
  await awaitBunkerSubscriptionReady(
    pool,
    bp.relays,
    `signer:${bp.pubkey.slice(0, 8)}`
  );

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
