/**
 * Remote signer sessions: config matching and matchOrCreate.
 * Depends on CRUD and types.
 */

import { convertToHex } from "~/lib/nostr-conversion";

import type { ActiveSignerConfig } from "./nostr-signer-storage.client";
import {
  getAllConnections,
  getConnectionById,
  getConnectionWithCurrentSession,
  createConnection,
  updateConnection,
} from "./remote-signer-sessions-crud.client";
import type {
  RemoteSignerConnection,
  ConnectionWithCurrentSession,
  MatchOrCreateSessionOptions,
} from "./remote-signer-sessions-types";

export function normalizePubkeyHex(
  pubkey: string | null | undefined
): string | null {
  if (!pubkey) {
    return null;
  }
  const normalized = convertToHex(pubkey) ?? pubkey;
  const trimmed = normalized.trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(trimmed) ? trimmed : null;
}

export function normalizeUriForIdentity(uri: string): string {
  const trimmed = uri.trim();
  try {
    const parsed = new URL(trimmed);
    parsed.searchParams.delete("callback");
    const next = new URLSearchParams();
    const entries = Array.from(parsed.searchParams.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    for (const [key, value] of entries) {
      next.append(key, value);
    }
    const normalizedQuery = next.toString();
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}${normalizedQuery ? `?${normalizedQuery}` : ""}`;
  } catch {
    return trimmed;
  }
}

export function isConfigEquivalent(
  existing: ActiveSignerConfig,
  incoming: ActiveSignerConfig
): boolean {
  if (existing.type !== "nip46" || incoming.type !== "nip46") {
    return false;
  }
  if (existing.method !== incoming.method) {
    return false;
  }
  if (
    existing.method === "nostrconnect_uri" &&
    incoming.method === "nostrconnect_uri"
  ) {
    return (
      normalizeUriForIdentity(existing.uri) ===
        normalizeUriForIdentity(incoming.uri) &&
      existing.clientSecretKeyHex === incoming.clientSecretKeyHex
    );
  }
  if (
    existing.method === "bunker_input" &&
    incoming.method === "bunker_input"
  ) {
    return (
      existing.bunkerInput.trim() === incoming.bunkerInput.trim() &&
      existing.clientSecretKeyHex === incoming.clientSecretKeyHex
    );
  }
  return false;
}

function getLatestConnection(
  connections: RemoteSignerConnection[]
): RemoteSignerConnection | null {
  if (connections.length === 0) return null;
  return connections.reduce((latest, c) =>
    c.metadata.updatedAt > latest.metadata.updatedAt ? c : latest
  );
}

export function findMatchingConnectionForConfig(
  config: ActiveSignerConfig,
  signerPubkey?: string | null
): RemoteSignerConnection | null {
  const connections = getAllConnections();
  if (config.type !== "nip46") return null;
  const pubkeyHex = normalizePubkeyHex(signerPubkey);
  if (pubkeyHex) {
    const byPubkey = connections.filter((c) => {
      if (c.config.type !== "nip46" || c.config.method !== config.method)
        return false;
      return normalizePubkeyHex(c.metadata.pubkey) === pubkeyHex;
    });
    const latest = getLatestConnection(byPubkey);
    if (latest) return latest;
  }
  const byConfig = connections.filter((c) =>
    isConfigEquivalent(c.config, config)
  );
  return getLatestConnection(byConfig);
}

export function findMatchingSessionForConfig(
  config: ActiveSignerConfig,
  signerPubkey?: string | null
): ConnectionWithCurrentSession | null {
  const conn = findMatchingConnectionForConfig(config, signerPubkey);
  if (!conn) return null;
  return getConnectionWithCurrentSession(conn.id);
}

export function matchOrCreateConnection(
  config: ActiveSignerConfig,
  options?: MatchOrCreateSessionOptions
): RemoteSignerConnection {
  const existing = findMatchingConnectionForConfig(
    config,
    options?.signerPubkey
  );
  if (existing) {
    const updates: Partial<Pick<RemoteSignerConnection, "label" | "config">> =
      {};
    if (options?.label && existing.label !== options.label)
      updates.label = options.label;
    if (existing.config !== config) updates.config = config;
    if (Object.keys(updates).length > 0) {
      updateConnection(existing.id, updates);
      return getConnectionById(existing.id) ?? { ...existing, ...updates };
    }
    return existing;
  }
  return createConnection(
    config,
    options?.label ?? `Connection ${getAllConnections().length + 1}`
  );
}

export function matchOrCreateSession(
  config: ActiveSignerConfig,
  options?: MatchOrCreateSessionOptions
): ConnectionWithCurrentSession {
  const conn = matchOrCreateConnection(config, options);
  return (
    getConnectionWithCurrentSession(conn.id) ?? {
      connection: conn,
      currentSession: null,
    }
  );
}
