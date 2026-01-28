import { SimplePool, getPublicKey } from "nostr-tools";
import { BunkerSigner, parseBunkerInput } from "nostr-tools/nip46";

import {
  Nip07Signer,
  Nip46Signer,
  type NostrSigner,
} from "~/features/auth/nostr-signer.client";
import type { NostrEvent, SignedEvent } from "~/features/nostr/types";

export type ActiveSignerConfig =
  | { type: "nip07" }
  | {
      type: "nip46";
      method: "bunker_input";
      bunkerInput: string;
      clientSecretKeyHex: string;
    }
  | {
      type: "nip46";
      method: "nostrconnect_uri";
      uri: string;
      clientSecretKeyHex: string;
      relays: string[];
    };

const STORAGE_KEY = "__smartflow_active_nostr_signer_v1";

let cachedSigner: NostrSigner | null = null;
let cachedConfigJson: string | null = null;
let wasHidden = false;
let _lastVisibilityChangeTime = 0; // Reserved for future metrics/debugging
let connectionCooldownUntil = 0;
let healthCheckInterval: ReturnType<typeof setInterval> | null = null;
let connectionEstablishedAt: number | null = null;
let _lastActivityTime: number | null = null; // Reserved for future metrics/debugging

/**
 * Clear the in-memory signer cache without removing persisted config.
 * Useful when a NIP-46 remote signer connection becomes stale.
 */
export function resetCachedSigner(): void {
  cachedSigner = null;
}

/**
 * Detect if we're on iOS (mobile Safari or webview)
 */
function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * Detect if we're on a mobile device (iOS or Android)
 */
function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    ) || !!(navigator.maxTouchPoints && navigator.maxTouchPoints > 1)
  );
}

/**
 * Clear cached NIP-46 signer connections.
 * This is called when we detect the page was hidden or when connections fail.
 */
function clearCachedNip46Signer(): void {
  const config = getActiveSignerConfig();
  if (config?.type === "nip46" && cachedSigner) {
    // Close existing connections gracefully
    if (cachedSigner.type === "nip46" && cachedSigner.close) {
      const closeFn = cachedSigner.close;
      void (async () => {
        try {
          await closeFn();
        } catch {
          // Ignore errors during cleanup
        }
      })();
    }
    resetCachedSigner();
    stopHealthCheckMonitoring();
    connectionEstablishedAt = null;
    _lastActivityTime = null;
  }
}

/**
 * Initialize page visibility detection to reset cached NIP-46 signers
 * when the page becomes visible again after being hidden.
 * This helps recover from stale WebSocket connections when users switch
 * between the browser and signer app on the same device.
 * On iOS, adds a cooldown period after becoming visible to allow WebSocket
 * connections to stabilize before attempting new connections.
 */
function initVisibilityHandler(): void {
  if (typeof document === "undefined") return;

  // Track if page was hidden
  const handleVisibilityChange = () => {
    const now = Date.now();
    if (document.hidden) {
      wasHidden = true;
      _lastVisibilityChangeTime = now;
    } else if (wasHidden) {
      // Page became visible again after being hidden
      // Only clear cached NIP-46 signer if there's an established connection
      // Don't clear during active connection attempts (when cachedSigner doesn't exist yet)
      // This prevents interrupting in-progress connection attempts
      const config = getActiveSignerConfig();
      if (config?.type === "nip46" && cachedSigner) {
        // Only clear if we have an established connection, not during an active attempt
        clearCachedNip46Signer();
      }
      wasHidden = false;

      // Add a cooldown period after becoming visible
      // This gives WebSocket connections time to stabilize
      // iOS aggressively closes WebSocket connections when apps are backgrounded
      // Android can also have issues, though less frequently
      if (isMobile()) {
        // Mobile devices: longer cooldown (iOS needs more, Android benefits too)
        const baseCooldown = isIOS() ? 1500 : 800; // iOS: 1.5s, Android: 0.8s
        const cooldownMs = baseCooldown + Math.random() * 500;
        connectionCooldownUntil = now + cooldownMs;
      } else {
        // Desktop: shorter cooldown
        connectionCooldownUntil = now + 500; // 0.5 seconds
      }
    }
  };

  // Also listen for focus events as a backup (handles some edge cases)
  const handleFocus = () => {
    if (wasHidden) {
      // Only clear cached signer if there's an established connection
      // Don't clear during active connection attempts
      const config = getActiveSignerConfig();
      if (config?.type === "nip46" && cachedSigner) {
        clearCachedNip46Signer();
      }
      wasHidden = false;
      const now = Date.now();
      if (isMobile()) {
        const baseCooldown = isIOS() ? 1500 : 800;
        const cooldownMs = baseCooldown + Math.random() * 500;
        connectionCooldownUntil = now + cooldownMs;
      } else {
        connectionCooldownUntil = now + 500;
      }
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("focus", handleFocus);
}

// Initialize visibility handler when module loads
if (typeof window !== "undefined") {
  initVisibilityHandler();
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(normalized) || normalized.length % 2 !== 0) {
    throw new Error("Invalid hex");
  }
  const out = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function serializeSecretKey(key: Uint8Array): string {
  return bytesToHex(key);
}

export function clearActiveSignerConfig(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  cachedSigner = null;
  cachedConfigJson = null;
}

export function setActiveSignerConfig(config: ActiveSignerConfig): void {
  try {
    const json = JSON.stringify(config);
    sessionStorage.setItem(STORAGE_KEY, json);
    cachedConfigJson = json;
    cachedSigner = null;
  } catch {
    // ignore
  }
}

export function getActiveSignerConfig(): ActiveSignerConfig | null {
  try {
    const json = sessionStorage.getItem(STORAGE_KEY);
    if (!json) return null;
    if (cachedConfigJson === json && cachedSigner) {
      // config unchanged; signer already cached
      return JSON.parse(json) as ActiveSignerConfig;
    }
    return JSON.parse(json) as ActiveSignerConfig;
  } catch {
    return null;
  }
}

/**
 * Verify that a cached NIP-46 signer connection is still valid.
 * Returns true if the signer is available and can be used, false otherwise.
 * Uses a quick health check with a short timeout to avoid blocking.
 */
async function verifySignerConnection(signer: NostrSigner): Promise<boolean> {
  if (signer.type !== "nip46") return true; // NIP-07 doesn't need verification

  try {
    // Quick health check: try to get public key with a short timeout
    // This will fail if the connection is stale or the signer is unreachable
    await Promise.race([
      signer.getPublicKey(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Connection check timeout")), 2000)
      ),
    ]);
    _lastActivityTime = Date.now();
    return true;
  } catch {
    // Any error means the connection is stale or unreachable
    // This includes "subscription closed", websocket errors, and other connection issues
    return false;
  }
}

/**
 * Start periodic health checks for active NIP-46 connections
 */
function startHealthCheckMonitoring(): void {
  if (healthCheckInterval) return; // Already monitoring

  healthCheckInterval = setInterval(() => {
    void (async () => {
      const config = getActiveSignerConfig();
      if (config?.type !== "nip46" || !cachedSigner) {
        // No active NIP-46 connection, stop monitoring
        if (healthCheckInterval) {
          clearInterval(healthCheckInterval);
          healthCheckInterval = null;
        }
        return;
      }

      // Check if connection is old enough to warrant health check
      const now = Date.now();
      if (
        connectionEstablishedAt &&
        now - connectionEstablishedAt > 5 * 60 * 1000
      ) {
        // Connection is older than 5 minutes, perform health check
        const isValid = await verifySignerConnection(cachedSigner);
        if (!isValid) {
          // Connection is stale, clear it
          clearCachedNip46Signer();
          connectionEstablishedAt = null;
          _lastActivityTime = null;

          // Emit event for connection state change
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("nostr-connection-stale", {
                detail: { signerType: "nip46" },
              })
            );
          }
        }
      }
    })();
  }, 30_000); // Check every 30 seconds
}

/**
 * Stop health check monitoring
 */
function stopHealthCheckMonitoring(): void {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
}

// Complex signer resolution with caching, health checks, cooldowns, and platform-specific optimizations
// eslint-disable-next-line sonarjs/cognitive-complexity -- Signer management requires handling multiple connection types, visibility changes, cooldowns, and error recovery
export async function getActiveSigner(): Promise<NostrSigner | null> {
  // If we have a cached signer, verify it's still valid before returning it
  if (cachedSigner) {
    // Quick health check before critical operations
    const isValid = await verifySignerConnection(cachedSigner);
    if (isValid) {
      _lastActivityTime = Date.now();
      return cachedSigner;
    }
    // Connection is stale, clear cache and reconnect
    clearCachedNip46Signer();

    // Emit connection stale event
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("nostr-connection-stale", {
          detail: { signerType: "nip46" },
        })
      );
    }
  }

  const config = getActiveSignerConfig();
  if (!config) return null;

  if (config.type === "nip07") {
    cachedSigner = new Nip07Signer();
    return cachedSigner;
  }

  // Check if we're in a cooldown period after app became visible
  // This helps prevent connection attempts immediately after returning from background
  const now = Date.now();
  if (now < connectionCooldownUntil) {
    const waitMs = connectionCooldownUntil - now;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const clientSecretKey = hexToBytes(config.clientSecretKeyHex);
  let pool: SimplePool | null = new SimplePool();

  try {
    if (config.method === "bunker_input") {
      const bp = await parseBunkerInput(config.bunkerInput);
      if (!bp) {
        throw new Error("Invalid bunker input");
      }
      const inner = BunkerSigner.fromBunker(clientSecretKey, bp, { pool });
      await inner.connect();
      cachedSigner = new Nip46Signer({ pool, inner });
      pool = null; // Transfer ownership to cachedSigner
      connectionEstablishedAt = Date.now();
      _lastActivityTime = Date.now();
      startHealthCheckMonitoring();

      // Emit connection healthy event
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("nostr-connection-healthy", {
            detail: { signerType: "nip46" },
          })
        );
      }

      return cachedSigner;
    }

    // nostrconnect_uri
    const inner = await BunkerSigner.fromURI(
      clientSecretKey,
      config.uri,
      { pool },
      60_000
    );
    cachedSigner = new Nip46Signer({ pool, inner });
    pool = null; // Transfer ownership to cachedSigner
    connectionEstablishedAt = Date.now();
    _lastActivityTime = Date.now();
    startHealthCheckMonitoring();

    // Emit connection healthy event
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("nostr-connection-healthy", {
          detail: { signerType: "nip46" },
        })
      );
    }

    return cachedSigner;
  } catch (err) {
    // Clean up pool if connection failed
    if (pool) {
      try {
        // Close any relay connections that might have been opened
        // When method is nostrconnect_uri, relays is always defined in the type
        if (config.method === "nostrconnect_uri") {
          pool.close(config.relays);
        }
      } catch {
        // Ignore cleanup errors
      }
    }

    // If connection fails, clear the cache to prevent retrying with stale data
    const errorMessage =
      err instanceof Error
        ? err.message.toLowerCase()
        : String(err).toLowerCase();
    if (
      errorMessage.includes("subscription closed") ||
      errorMessage.includes("websocket") ||
      errorMessage.includes("closed") ||
      errorMessage.includes("connection")
    ) {
      // Clear cache on connection errors so next attempt will be fresh
      resetCachedSigner();

      // On mobile, extend cooldown period after connection errors
      // This gives more time for WebSocket connections to stabilize
      if (isMobile()) {
        const errorCooldown = isIOS() ? 2000 : 1500; // iOS: 2s, Android: 1.5s
        connectionCooldownUntil = now + errorCooldown;
      }
    }
    throw err;
  }
}

/**
 * A minimal signer shape compatible with libraries expecting NIP-07 style `window.nostr`.
 */
export async function getWindowNostrLikeSigner(): Promise<{
  getPublicKey: () => Promise<string>;
  signEvent: (event: NostrEvent) => Promise<SignedEvent>;
} | null> {
  // Prefer configured signer if present
  const active = await getActiveSigner();
  if (active) {
    return {
      getPublicKey: async () => await active.getPublicKey(),
      signEvent: async (event: NostrEvent) => await active.signEvent(event),
    };
  }

  // Fallback to extension if available
  // @ts-ignore - injected at runtime by extensions
  if (typeof window !== "undefined" && window.nostr) {
    // @ts-ignore - injected at runtime by extensions
    return window.nostr;
  }

  return null;
}

export async function getActiveSignerPubkeyHint(): Promise<string | null> {
  const cfg = getActiveSignerConfig();
  if (!cfg) return null;
  if (cfg.type === "nip07") return null;
  try {
    const sk = hexToBytes(cfg.clientSecretKeyHex);
    return getPublicKey(sk);
  } catch {
    return null;
  }
}
