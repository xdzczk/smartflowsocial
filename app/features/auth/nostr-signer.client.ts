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
 */
const NIP46_RPC_TIMEOUTS = {
  signEvent: 25_000,
  getPublicKey: 10_000,
  nip04Encrypt: 15_000,
  nip44Encrypt: 15_000,
  ping: 4_000,
  switchRelays: 8_000,
} as const;

/** NIP-46 / Nostr Connect kind. */
const NOSTR_CONNECT_KIND = 24_133;

/** Hard cap on how long we'll wait for the relay to acknowledge our REQ. */
const REQ_READY_TIMEOUT_MS = 5_000;

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

  constructor(input: { pool: SimplePool; inner: BunkerSigner }) {
    this.pool = input.pool;
    this.inner = input.inner;
  }

  getStatus(): SignerStatus {
    return this.status;
  }

  setStatus(next: SignerStatus): void {
    this.status = next;
  }

  /**
   * Open a fresh REQ subscription on the bunker relays AND wait for the
   * relay to acknowledge it (EOSE) before letting the next RPC publish its
   * EVENT.
   *
   * Why this exists:
   *
   * - `nostr-tools`' `BunkerSigner.sendRequest` opens its REQ subscription
   *   and publishes the EVENT in the same tick, with no synchronization
   *   between them. The REQ and EVENT race through `pool.subscribe` and
   *   `pool.publish`, both of which await `ensureRelay` before sending. On
   *   the wire the order is usually REQ-then-EVENT, but the second sign of
   *   a session is exactly the case where the bunker's reply can come back
   *   so quickly that we miss it: the relay processes our EVENT, broadcasts
   *   to the bunker's mirror sub, the bunker auto-approves (it just saw the
   *   user approve a moment ago) and publishes its reply, and our sub is
   *   not yet "live" enough to pick the reply out of backlog. Result: the
   *   listener for that request id is never invoked and the call hangs
   *   until our 25s timeout fires.
   *
   * - Ditto avoids this with `@nostrify/nostrify`'s `NConnectSigner.send`,
   *   which has the comment "Ensure the REQ is opened before sending the
   *   EVENT" and structurally opens the REQ first, awaits a relay
   *   acknowledgement, and only then publishes.
   *
   * What we do here:
   *
   * 1. Close any existing `subCloser` (the construction-time one or the
   *    one left over from the previous RPC).
   * 2. Open our own `pool.subscribe` with the same filter `BunkerSigner`
   *    uses, but with an `oneose` callback so we know when the relay has
   *    finished registering it. The `onevent` decrypts and dispatches into
   *    `BunkerSigner.listeners` exactly the way the bunker's own subscription
   *    would, so the bunker's RPC dispatch keeps working unchanged.
   * 3. Hand the resulting closer to the bunker via `inner.subCloser`. When
   *    `BunkerSigner.sendRequest` runs next, it sees `subCloser` is already
   *    set and skips its own `setupSubscription()`, so it goes straight to
   *    publishing the EVENT — and now the REQ is guaranteed to be live on
   *    the relay first.
   * 4. Await the EOSE (with a safety timeout so a relay that never sends
   *    EOSE doesn't deadlock the signer).
   */
  private async refreshBunkerSubscription(): Promise<void> {
    const inner = this.inner as unknown as BunkerSignerInternals;
    if (!inner.isOpen) return;

    const oldCloser = inner.subCloser;
    inner.subCloser = undefined;
    if (oldCloser) {
      try {
        await oldCloser.close("nip46:per-rpc-refresh");
      } catch {
        // Best-effort: even if close fails, clearing subCloser ensures we
        // build the fresh subscription below.
      }
    }

    const clientPubkey = getPublicKey(inner.secretKey);
    const convKey = inner.conversationKey;
    const listeners = inner.listeners;
    const waitingForAuth = inner.waitingForAuth;
    const onauth = inner.params?.onauth;

    let resolveReady: () => void = () => {
      // assigned below; placeholder satisfies the no-useless-undefined lint
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
        onevent: (event: { content: string }) => {
          let decoded: BunkerResponseEnvelope;
          try {
            const plaintext = nip44Decrypt(event.content, convKey);
            decoded = JSON.parse(plaintext) as BunkerResponseEnvelope;
          } catch {
            return;
          }
          const { id, result, error } = decoded;
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
          resolveReady();
        },
        onclose: () => {
          // Mirror BunkerSigner's own onclose so it sees the sub is gone
          // (e.g. relay-initiated close) and rebuilds on the next RPC.
          if (inner.subCloser === closer) {
            inner.subCloser = undefined;
          }
          // Unblock anyone still awaiting `ready` — better to fall through
          // and let the EVENT publish than to hang on a torn-down sub.
          resolveReady();
        },
      }
    );

    inner.subCloser = closer;
    inner.isOpen = true;

    let safetyTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        ready,
        new Promise<void>((resolve) => {
          safetyTimer = setTimeout(resolve, REQ_READY_TIMEOUT_MS);
        }),
      ]);
    } finally {
      if (safetyTimer) clearTimeout(safetyTimer);
    }
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
    try {
      await previous.catch(() => {
        // Swallow upstream rejections so one failed RPC doesn't poison the
        // lock for the next caller.
      });
      await this.refreshBunkerSubscription();
      let to: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          fn(),
          new Promise<never>((_, reject) => {
            to = setTimeout(
              () => reject(new Error(`bunker:${label} timeout`)),
              timeoutMs
            );
          }),
        ]);
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
