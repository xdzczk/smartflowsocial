/**
 * NIP-46 connect for login: bunker input and Nostr Connect URI.
 * Pure async functions; no React. Used by nip46-login hook.
 */

import { generateSecretKey, type SimplePool } from "nostr-tools";
import { parseBunkerInput } from "nostr-tools/nip46";

import type { ActiveSignerConfig } from "~/features/auth/signer";
import { serializeSecretKey } from "~/features/auth/signer";
import { getSharedPool } from "~/features/nostr/shared-pool.client";
import { BRAND_NAME } from "~/lib/brand";
import { convertToHex } from "~/lib/nostr-conversion";

import {
  connectNip46WithBunkerInput,
  connectNip46WithNostrConnectUri,
  createNip46NostrConnectUri,
  getNostrConnectAppMetadata,
  type Nip46Signer,
  type NostrSigner,
} from "../nostr-signer.client";

export interface ConnectNip46WithBunkerInputForLoginParams {
  bunkerInput: string;
  timeoutMs: number;
  retryCount?: number;
}

export interface ConnectNip46WithBunkerInputForLoginResult {
  signer: Nip46Signer;
  pubkey: string;
  config: Extract<
    ActiveSignerConfig,
    { type: "nip46"; method: "bunker_input" }
  >;
}

export async function connectNip46WithBunkerInputForLogin(
  params: ConnectNip46WithBunkerInputForLoginParams
): Promise<ConnectNip46WithBunkerInputForLoginResult> {
  const clientSecretKey = generateSecretKey();
  const trimmed = params.bunkerInput.trim();
  const { signer, pubkey } = await connectNip46WithBunkerInput({
    bunkerInput: trimmed,
    clientSecretKey,
    timeoutMs: params.timeoutMs,
    retryCount: params.retryCount,
  });
  // Persist the bunker's relays alongside the input so any caller that reads
  // `cfg.relays` (Settings UI, transport-health helpers, etc.) sees them.
  // Without this the field would stay undefined until `switch_relays` ever
  // overrode it, and helpers that treat empty relays as "transport dead"
  // would wrongly throw away the freshly-cached signer.
  const bp = await parseBunkerInput(trimmed).catch(() => null);
  const relays =
    bp?.relays.map((r) => r.trim()).filter((r) => r.startsWith("wss://")) ?? [];
  const config: ConnectNip46WithBunkerInputForLoginResult["config"] = {
    type: "nip46",
    method: "bunker_input",
    bunkerInput: trimmed,
    clientSecretKeyHex: serializeSecretKey(clientSecretKey),
    ...(relays.length > 0 && { relays }),
  };
  return { signer, pubkey, config };
}

export interface ConnectNip46WithNostrConnectUriForLoginParams {
  relays: string[];
  timeoutMs: number;
  retryCount?: number;
  appName?: string;
  /** Called with uri, pool, relays, clientSecretKey before connecting so the caller can set UI state and cancel ref. */
  onUriCreated?: (
    uri: string,
    pool: SimplePool,
    relays: string[],
    clientSecretKey: Uint8Array
  ) => void;
}

export interface ConnectNip46WithNostrConnectUriForLoginResult {
  signer: NostrSigner;
  pubkey: string;
  config: Extract<
    ActiveSignerConfig,
    { type: "nip46"; method: "nostrconnect_uri" }
  >;
  pool: SimplePool;
  relays: string[];
  uri: string;
}

export async function connectNip46WithNostrConnectUriForLogin(
  params: ConnectNip46WithNostrConnectUriForLoginParams
): Promise<ConnectNip46WithNostrConnectUriForLoginResult> {
  const created = createNip46NostrConnectUri({
    relays: params.relays,
    appName: params.appName ?? BRAND_NAME,
    ...getNostrConnectAppMetadata(),
  });
  params.onUriCreated?.(
    created.uri,
    created.pool,
    created.relays,
    created.clientSecretKey
  );
  const { signer, pubkey } = await connectNip46WithNostrConnectUri({
    uri: created.uri,
    clientSecretKey: created.clientSecretKey,
    pool: created.pool,
    timeoutMs: params.timeoutMs,
    relaysToCloseOnCancel: created.relays,
    retryCount: params.retryCount,
  });
  const bunkerPointer =
    "getBunkerPointer" in signer
      ? (
          signer as {
            getBunkerPointer(): {
              pubkey: string;
              relays: string[];
              secret: null | string;
            };
          }
        ).getBunkerPointer()
      : undefined;
  const config: ConnectNip46WithNostrConnectUriForLoginResult["config"] = {
    type: "nip46",
    method: "nostrconnect_uri",
    uri: created.uri,
    relays: created.relays,
    clientSecretKeyHex: serializeSecretKey(created.clientSecretKey),
    signerPubkey: convertToHex(pubkey) ?? pubkey,
    ...(bunkerPointer && { bunkerPointer }),
  };
  return {
    signer,
    pubkey,
    config,
    pool: created.pool,
    relays: created.relays,
    uri: created.uri,
  };
}

export interface ConnectNip46WithPendingUriForLoginParams {
  uri: string;
  clientSecretKey: Uint8Array;
  relays: string[];
  timeoutMs: number;
  retryCount?: number;
  /** Called with pool and relays so the caller can set cancel ref. */
  onPoolCreated?: (pool: SimplePool, relays: string[]) => void;
}

export interface ConnectNip46WithPendingUriForLoginResult {
  signer: NostrSigner;
  pubkey: string;
  config: Extract<
    ActiveSignerConfig,
    { type: "nip46"; method: "nostrconnect_uri" }
  >;
}

export async function connectNip46WithPendingUriForLogin(
  params: ConnectNip46WithPendingUriForLoginParams
): Promise<ConnectNip46WithPendingUriForLoginResult> {
  const pool = getSharedPool();
  params.onPoolCreated?.(pool, params.relays);
  const { signer, pubkey } = await connectNip46WithNostrConnectUri({
    uri: params.uri,
    clientSecretKey: params.clientSecretKey,
    pool,
    timeoutMs: params.timeoutMs,
    relaysToCloseOnCancel: params.relays,
    retryCount: params.retryCount ?? 1,
  });
  const bunkerPointer =
    "getBunkerPointer" in signer
      ? (
          signer as {
            getBunkerPointer(): {
              pubkey: string;
              relays: string[];
              secret: null | string;
            };
          }
        ).getBunkerPointer()
      : undefined;
  const config: ConnectNip46WithPendingUriForLoginResult["config"] = {
    type: "nip46",
    method: "nostrconnect_uri",
    uri: params.uri,
    relays: params.relays,
    clientSecretKeyHex: serializeSecretKey(params.clientSecretKey),
    signerPubkey: convertToHex(pubkey) ?? pubkey,
    ...(bunkerPointer && { bunkerPointer }),
  };
  return { signer, pubkey, config };
}
