import { generateSecretKey, nip19, SimplePool } from "nostr-tools";

import {
  connectNip46WithBunkerInput,
  connectNip46WithNostrConnectUri,
} from "~/features/auth/nostr-signer.client";
import {
  serializeSecretKey,
  setActiveSignerConfig,
  type ActiveSignerConfig,
} from "~/lib/nostr-signer-manager.client";
import type { PrimarySignerProfile } from "~/lib/primary-signer-profile";
import { isPrimarySignerProfile } from "~/lib/primary-signer-profile";
import {
  emitOpenRemoteSignerReconnectDialogEvent,
  emitRemoteSignerTimeoutEvent,
} from "~/lib/remote-signer-reconnect.client";
import {
  createSession,
  detectSignerAppName,
  getAllSessions,
  setActiveSession,
  updateSession,
} from "~/lib/remote-signer-sessions.client";
import { recordConnectionEvent } from "~/lib/remote-signer-status.client";

const PRIMARY_SIGNER_PROFILE_API = "/api/primary-signer-profile";
const PROFILE_CACHE_TTL_MS = 30_000;
const DEFAULT_FAILOVER_TIMEOUT_MS = 20_000;

let cachedProfile: { value: PrimarySignerProfile | null; at: number } | null =
  null;

function normalizeExpectedPubkeyHex(
  expected: string | null | undefined
): string | null {
  if (!expected) return null;
  const trimmed = expected.trim();
  if (!trimmed) return null;
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  if (trimmed.startsWith("npub")) {
    try {
      const decoded = nip19.decode(trimmed);
      return typeof decoded.data === "string"
        ? decoded.data.toLowerCase()
        : null;
    } catch {
      return null;
    }
  }
  return null;
}

function getMatchingSessionIdForProfile(
  profile: PrimarySignerProfile
): string | null {
  const sessions = getAllSessions();
  const existing = sessions.find((session) => {
    if (session.config.type !== "nip46") {
      return false;
    }
    if (profile.method === "bunker_input") {
      return (
        session.config.method === "bunker_input" &&
        session.config.bunkerInput === profile.bunkerInput
      );
    }
    return (
      session.config.method === "nostrconnect_uri" &&
      session.config.uri === profile.uri
    );
  });

  return existing?.id ?? null;
}

function buildConfigFromProfile(
  profile: PrimarySignerProfile,
  clientSecretKey: Uint8Array
): ActiveSignerConfig {
  if (profile.method === "bunker_input") {
    return {
      type: "nip46",
      method: "bunker_input",
      bunkerInput: profile.bunkerInput,
      clientSecretKeyHex: serializeSecretKey(clientSecretKey),
    };
  }

  return {
    type: "nip46",
    method: "nostrconnect_uri",
    uri: profile.uri,
    relays: profile.relays,
    clientSecretKeyHex: serializeSecretKey(clientSecretKey),
  };
}

async function connectProfile(
  profile: PrimarySignerProfile,
  timeoutMs: number
): Promise<{ pubkey: string; config: ActiveSignerConfig }> {
  const clientSecretKey = generateSecretKey();
  const config = buildConfigFromProfile(profile, clientSecretKey);

  if (profile.method === "bunker_input") {
    const { signer, pubkey } = await connectNip46WithBunkerInput({
      bunkerInput: profile.bunkerInput,
      clientSecretKey,
      timeoutMs,
    });
    await signer.close();
    return { pubkey, config };
  }

  const pool = new SimplePool();
  try {
    const { signer, pubkey } = await connectNip46WithNostrConnectUri({
      uri: profile.uri,
      clientSecretKey,
      pool,
      timeoutMs,
      relaysToCloseOnCancel: profile.relays,
    });
    await signer.close();
    return { pubkey, config };
  } finally {
    try {
      pool.close(profile.relays);
    } catch {
      // ignore
    }
  }
}

export async function fetchPrimarySignerProfile(options?: {
  force?: boolean;
}): Promise<PrimarySignerProfile | null> {
  const now = Date.now();
  if (
    !options?.force &&
    cachedProfile &&
    now - cachedProfile.at < PROFILE_CACHE_TTL_MS
  ) {
    return cachedProfile.value;
  }

  try {
    const response = await fetch(PRIMARY_SIGNER_PROFILE_API, {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      cachedProfile = { value: null, at: now };
      return null;
    }

    const payload = (await response.json()) as {
      primarySignerProfile?: unknown;
    };
    const value = isPrimarySignerProfile(payload.primarySignerProfile)
      ? payload.primarySignerProfile
      : null;
    cachedProfile = { value, at: now };
    return value;
  } catch {
    cachedProfile = { value: null, at: now };
    return null;
  }
}

export function clearPrimarySignerProfileCache(): void {
  cachedProfile = null;
}

export async function testPrimarySignerProfileConnection(
  profile: PrimarySignerProfile,
  expectedPubkey: string | null | undefined
): Promise<{ ok: true; pubkey: string } | { ok: false; error: string }> {
  try {
    const { pubkey } = await connectProfile(
      profile,
      DEFAULT_FAILOVER_TIMEOUT_MS
    );
    const expectedHex = normalizeExpectedPubkeyHex(expectedPubkey);
    if (expectedHex && pubkey.toLowerCase() !== expectedHex) {
      return {
        ok: false,
        error: "Connected signer pubkey does not match your logged-in profile.",
      };
    }
    return { ok: true, pubkey };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Primary signer test failed",
    };
  }
}

export async function attemptPrimarySignerFailover(input?: {
  expectedPubkey?: string | null;
  timeoutMs?: number;
  labelFallback?: string;
  profile?: PrimarySignerProfile | null;
}): Promise<{ recovered: boolean; reason?: string }> {
  const profile =
    input?.profile ?? (await fetchPrimarySignerProfile({ force: true }));
  if (!profile) {
    return { recovered: false, reason: "no_primary_profile" };
  }

  try {
    const timeoutMs = input?.timeoutMs ?? DEFAULT_FAILOVER_TIMEOUT_MS;
    const { pubkey, config } = await connectProfile(profile, timeoutMs);
    const expectedHex = normalizeExpectedPubkeyHex(
      input?.expectedPubkey ?? profile.expectedPubkey
    );
    if (expectedHex && pubkey.toLowerCase() !== expectedHex) {
      return { recovered: false, reason: "pubkey_mismatch" };
    }

    setActiveSignerConfig(config);

    const existingId = getMatchingSessionIdForProfile(profile);
    const label =
      profile.label ?? input?.labelFallback ?? "Primary Home Signer";
    const sessionId = (() => {
      if (!existingId) {
        return createSession(config, label).id;
      }
      updateSession(existingId, {
        config,
        label,
      });
      return existingId;
    })();

    setActiveSession(sessionId);
    const currentSession = getAllSessions().find(
      (session) => session.id === sessionId
    );
    if (!currentSession) {
      return { recovered: false, reason: "session_not_found" };
    }
    const signerAppName = detectSignerAppName(config);
    updateSession(sessionId, {
      metadata: {
        ...currentSession.metadata,
        status: "active",
        pubkey,
        signerAppName,
        connectedAt: Date.now(),
        lastActivityAt: Date.now(),
        lastError: null,
      },
    });
    recordConnectionEvent(sessionId, {
      type: "connected",
      pubkey,
    });

    return { recovered: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Primary signer fallback failed";
    emitRemoteSignerTimeoutEvent({
      message: `Primary signer fallback failed: ${message}`,
    });
    emitOpenRemoteSignerReconnectDialogEvent();
    return { recovered: false, reason: message };
  }
}
