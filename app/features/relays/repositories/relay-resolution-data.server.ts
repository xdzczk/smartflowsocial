import { prisma } from "~/lib/prisma.server";

function sanitizeRelayStrings(relays: unknown): string[] {
  if (!Array.isArray(relays)) return [];
  return relays
    .map((relay) => (typeof relay === "string" ? relay : String(relay)).trim())
    .filter((r) => r.length > 0);
}

export interface RelayIntent {
  writeRelays: string[];
}

/**
 * Read persisted relay intent (write relays only).
 * Uses User.userRelays as the canonical store.
 */
export async function getRelayIntentFromDb(
  userId: string
): Promise<{ writeRelays: string[] }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { userRelays: true },
  });
  if (!user) {
    throw new Error(`User ${userId} not found`);
  }
  const persisted = sanitizeRelayStrings(user.userRelays);
  return { writeRelays: persisted };
}

export async function isBlastrEnabledForUserFromDb(
  userId: string
): Promise<boolean> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    include: { Plan: true },
  });

  return !!(
    subscription?.status === "ACTIVE" && subscription.Plan?.enableRelayBlast
  );
}
