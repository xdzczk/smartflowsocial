/**
 * SFS Blastr admin API client (server-only).
 * Syncs entitlement and policy to Blastr. No-op when BLASTR_ADMIN_URL is unset.
 */

import { env } from "~/lib/env.server";
import { logError } from "~/lib/error-logger.server";
import { nostrAdapter } from "~/lib/nostr-adapter.server";

const CONTENT_TYPE_JSON = "application/json";

export type BlastrEntitlementStatus =
  | "active"
  | "grace"
  | "expired"
  | "suspended";

export interface BlastrUserPolicy {
  mode: "blacklist" | "whitelist";
  enabled: boolean;
}

export interface BlastrPolicyRelay {
  relay_url: string;
  action: "allow" | "block";
}

export interface BlastrUserPolicyResponse {
  pubkey: string;
  policy: BlastrUserPolicy | null;
  relays: BlastrPolicyRelay[];
}

function getBaseUrl(): string | null {
  const url = env.BLASTR_ADMIN_URL?.trim();
  return url && url.length > 0 ? url.replace(/\/$/, "") : null;
}

function getAuthHeaders(): Record<string, string> {
  const token = env.BLASTR_ADMIN_API_TOKEN?.trim();
  const headers: Record<string, string> = {
    "Content-Type": CONTENT_TYPE_JSON,
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
    headers["X-API-TOKEN"] = token;
  }
  return headers;
}

async function fetchBlastrAdmin(
  path: string,
  options: { method: string; body?: string } = { method: "GET" }
): Promise<Response> {
  const base = getBaseUrl();
  if (!base) {
    return new Response(null, { status: 0 });
  }
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, {
    method: options.method,
    headers: getAuthHeaders(),
    body: options.body,
  });
}

/**
 * Sync entitlement for a pubkey to Blastr (active/grace = can publish; expired/suspended = cannot).
 * No-op when BLASTR_ADMIN_URL is unset. Best-effort: logs errors, does not throw.
 */
export async function syncEntitlement(
  pubkeyHex: string,
  status: BlastrEntitlementStatus,
  planTier?: string
): Promise<void> {
  const base = getBaseUrl();
  if (!base || !pubkeyHex || pubkeyHex.length < 32) return;

  const path = `/admin/entitlements/${encodeURIComponent(pubkeyHex)}`;
  const body = JSON.stringify({
    status,
    plan_tier: planTier ?? "default",
  });

  try {
    const res = await fetchBlastrAdmin(path, { method: "PUT", body });
    if (!res.ok) {
      const text = await res.text();
      logError(new Error(`Blastr entitlement sync failed: ${res.status}`), {
        pubkeyLength: pubkeyHex.length,
        status,
        response: text.slice(0, 500),
      });
    }
  } catch (err) {
    logError(err instanceof Error ? err : new Error(String(err)), {
      context: "Blastr syncEntitlement",
      pubkeyLength: pubkeyHex.length,
    });
  }
}

/**
 * Resolve hex pubkey from a main-app user (User.npub may be npub or hex).
 */
export function resolvePubkeyHex(npubOrHex: string): string | null {
  if (!npubOrHex || typeof npubOrHex !== "string") return null;
  const trimmed = npubOrHex.trim();
  if (trimmed.length < 32) return null;
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return trimmed.toLowerCase();
  return nostrAdapter.decodeNpub(trimmed) ?? trimmed;
}

/**
 * Get user policy and policy relays from Blastr. Returns null when BLASTR_ADMIN_URL is unset or request fails.
 */
export async function getUserPolicy(
  pubkeyHex: string
): Promise<BlastrUserPolicyResponse | null> {
  const base = getBaseUrl();
  if (!base || !pubkeyHex || pubkeyHex.length < 32) return null;
  const path = `/admin/users/${encodeURIComponent(pubkeyHex)}/policy`;
  try {
    const res = await fetchBlastrAdmin(path, { method: "GET" });
    if (!res.ok) return null;
    const raw = (await res.json()) as {
      pubkey?: string;
      policy?: { mode?: string; enabled?: number };
      relays?: Array<{ relay_url?: string; action?: string }>;
    };
    const policy: BlastrUserPolicy | null =
      raw.policy != null
        ? {
            mode: raw.policy.mode === "whitelist" ? "whitelist" : "blacklist",
            enabled: raw.policy.enabled === 1,
          }
        : null;
    const relays: BlastrPolicyRelay[] = (raw.relays ?? []).map((r) => ({
      relay_url: typeof r.relay_url === "string" ? r.relay_url : "",
      action: r.action === "allow" ? "allow" : "block",
    }));
    return {
      pubkey: typeof raw.pubkey === "string" ? raw.pubkey : pubkeyHex,
      policy,
      relays,
    };
  } catch {
    return null;
  }
}

/**
 * Set user policy (mode and enabled). No-op when BLASTR_ADMIN_URL is unset.
 */
export async function putUserPolicy(
  pubkeyHex: string,
  body: { mode: "blacklist" | "whitelist"; enabled: boolean }
): Promise<boolean> {
  const base = getBaseUrl();
  if (!base || !pubkeyHex || pubkeyHex.length < 32) return false;
  const path = `/admin/users/${encodeURIComponent(pubkeyHex)}/policy`;
  try {
    const res = await fetchBlastrAdmin(path, {
      method: "PUT",
      body: JSON.stringify({
        mode: body.mode,
        enabled: body.enabled,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Add a relay to the user's policy (allow or block).
 */
export async function addPolicyRelay(
  pubkeyHex: string,
  relayUrl: string,
  action: "allow" | "block"
): Promise<boolean> {
  const base = getBaseUrl();
  if (!base || !pubkeyHex || pubkeyHex.length < 32 || !relayUrl.trim())
    return false;
  const path = `/admin/users/${encodeURIComponent(pubkeyHex)}/relays`;
  try {
    const res = await fetchBlastrAdmin(path, {
      method: "POST",
      body: JSON.stringify({ relay_url: relayUrl.trim(), action }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Remove a relay from the user's policy.
 */
export async function removePolicyRelay(
  pubkeyHex: string,
  relayUrl: string
): Promise<boolean> {
  const base = getBaseUrl();
  if (!base || !pubkeyHex || pubkeyHex.length < 32 || !relayUrl.trim())
    return false;
  const path = `/admin/users/${encodeURIComponent(pubkeyHex)}/relays?relay_url=${encodeURIComponent(relayUrl.trim())}`;
  try {
    const res = await fetchBlastrAdmin(path, { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}
