import { blastrRelay, DEFAULT_USER_WRITE_RELAYS } from "./relay-constants";
import {
  getRelayIntentFromDb,
  isBlastrEnabledForUserFromDb,
} from "./repositories/relay-resolution-data.server";

export type ManagedRelayId = "blastr";
export type ManagedRelayRole = "fanout";

export interface ManagedRelay {
  id: ManagedRelayId;
  role: ManagedRelayRole;
  enabled: boolean;
  relayUrl: string;
}

export interface RelayIntent {
  writeRelays: string[];
}

function normalizeRelays(relays: string[]): string[] {
  return Array.from(new Set(relays.map((r) => r.trim()).filter(Boolean)));
}

/**
 * Read persisted relay intent (write relays only, for now).
 * - Uses `User.userRelays` as the canonical persisted intent store.
 * - Applies `DEFAULT_USER_WRITE_RELAYS` only when the persisted list is empty.
 * - NEVER injects managed relays here.
 */
export async function getRelayIntent(userId: string): Promise<RelayIntent> {
  const { writeRelays: persisted } = await getRelayIntentFromDb(userId);
  const writeRelays =
    persisted.length > 0
      ? normalizeRelays(persisted)
      : DEFAULT_USER_WRITE_RELAYS;
  return { writeRelays };
}

/**
 * Compute the effective write relays for publishing (direct intent + managed relays).
 * - direct: user intent (persisted)
 * - managed: computed from feature access (Plan.enableRelayBlast + ACTIVE subscription)
 */
export async function getEffectiveWriteRelays(userId: string): Promise<{
  direct: string[];
  managed: ManagedRelay[];
}> {
  const intent = await getRelayIntent(userId);
  const blastrEnabled = await isBlastrEnabledForUserFromDb(userId);

  const managed: ManagedRelay[] = [
    {
      id: "blastr",
      role: "fanout",
      enabled: blastrEnabled,
      relayUrl: blastrRelay,
    },
  ];

  return {
    direct: intent.writeRelays,
    managed,
  };
}

/**
 * Flatten effective write relays into a single list suitable for execution.
 * The publisher layer may still prioritize/deprioritize based on health.
 */
export async function resolveExecutionRelays(
  userId: string
): Promise<string[]> {
  const { direct, managed } = await getEffectiveWriteRelays(userId);
  const enabledManagedRelays = managed
    .filter((m) => m.enabled)
    .map((m) => m.relayUrl);
  return normalizeRelays([...enabledManagedRelays, ...direct]);
}

/**
 * When the client sends `relays` as a JSON string array (composer relay picker),
 * use that list; otherwise {@link resolveExecutionRelays}.
 */
export async function resolveExecutionRelaysFromForm(
  userId: string,
  formData: FormData
): Promise<string[]> {
  const relayOverrideRaw = formData.get("relays");
  if (relayOverrideRaw && typeof relayOverrideRaw === "string") {
    try {
      const parsed = JSON.parse(relayOverrideRaw) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) {
        const urls = parsed.filter((r): r is string => typeof r === "string");
        if (urls.length > 0) return normalizeRelays(urls);
      }
    } catch {
      // fall through to server defaults
    }
  }
  return resolveExecutionRelays(userId);
}

/**
 * Helper for mapping upstream publisher results into an ACK-like status.
 * (Used by ACK persistence plumbing; kept here so callers share a single mapping.)
 */
export function mapPublisherOkToAckStatus(input: {
  ok: boolean;
  error?: string;
}): "ACCEPTED" | "FAILED" | "TIMEOUT" {
  if (input.ok) return "ACCEPTED";
  const m = input.error?.toLowerCase() ?? "";
  return m.includes("timeout") || m.includes("timed out")
    ? "TIMEOUT"
    : "FAILED";
}
