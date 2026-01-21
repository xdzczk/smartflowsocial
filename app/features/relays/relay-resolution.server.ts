import { prisma } from "~/lib/prisma.server";
import { blastrRelay, DEFAULT_USER_WRITE_RELAYS } from "~/lib/relays";

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

function sanitizeRelayStrings(relays: unknown): string[] {
  if (!Array.isArray(relays)) return [];
  return relays
    .map((relay) => (typeof relay === "string" ? relay : String(relay)).trim())
    .filter((r) => r.length > 0);
}

function normalizeRelays(relays: string[]): string[] {
  return Array.from(new Set(relays.map((r) => r.trim()).filter(Boolean)));
}

function isTimeoutErrorMessage(message: string | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return m.includes("timeout") || m.includes("timed out");
}

/**
 * Read persisted relay intent (write relays only, for now).
 * - Uses `User.userRelays` as the canonical persisted intent store.
 * - Applies `DEFAULT_USER_WRITE_RELAYS` only when the persisted list is empty.
 * - NEVER injects managed relays here.
 */
export async function getRelayIntent(userId: string): Promise<RelayIntent> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { userRelays: true },
  });
  if (!user) {
    throw new Error(`User ${userId} not found`);
  }
  const persisted = sanitizeRelayStrings(user.userRelays);
  const writeRelays =
    persisted.length > 0
      ? normalizeRelays(persisted)
      : DEFAULT_USER_WRITE_RELAYS;
  return { writeRelays };
}

async function isBlastrEnabledForUser(userId: string): Promise<boolean> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    include: { Plan: true },
  });

  return !!(
    subscription?.status === "ACTIVE" && subscription.Plan?.enableRelayBlast
  );
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
  const blastrEnabled = await isBlastrEnabledForUser(userId);

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
 * Helper for mapping upstream publisher results into an ACK-like status.
 * (Used by ACK persistence plumbing; kept here so callers share a single mapping.)
 */
export function mapPublisherOkToAckStatus(input: {
  ok: boolean;
  error?: string;
}): "ACCEPTED" | "FAILED" | "TIMEOUT" {
  if (input.ok) return "ACCEPTED";
  return isTimeoutErrorMessage(input.error) ? "TIMEOUT" : "FAILED";
}
