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
 */
const NIP46_RPC_TIMEOUTS = {
  signEvent: 25_000,
  getPublicKey: 10_000,
  nip04Encrypt: 15_000,
  nip44Encrypt: 15_000,
  ping: 4_000,
  switchRelays: 8_000,
} as const;

export class Nip46Signer implements NostrSigner {
  public readonly type = "nip46" as const;
  private readonly pool: SimplePool;
  private readonly inner: BunkerSigner;
  private status: SignerStatus = "available";

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

  private async rpc<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    label: string
  ): Promise<T> {
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
    await this.inner.close();
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
  const timeoutMs = input.timeoutMs ?? 15_000;
  const timeout = new Promise<never>((_resolve, reject) =>
    setTimeout(() => reject(new Error("SIGNER_TIMEOUT")), timeoutMs)
  );
  const pubkey = await Promise.race([signer.getPublicKey(), timeout]);
  return { signer, pubkey };
}
