import { prisma } from "~/lib/prisma.server";

function sanitizeRelayStrings(relays: unknown): string[] {
  if (!Array.isArray(relays)) return [];
  return relays
    .map((relay) => (typeof relay === "string" ? relay : String(relay)).trim())
    .filter((r) => r.length > 0);
}

export type PublishRelaySourceDb = "app" | "nip65_profile";

/**
 * Read persisted app relay list and publish source (NIP-65 vs app list).
 */
export async function getRelayIntentFromDb(userId: string): Promise<{
  appRelays: string[];
  publishRelaySource: PublishRelaySourceDb;
  npub: string;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { userRelays: true, publishRelaySource: true, npub: true },
  });
  if (!user) {
    throw new Error(`User ${userId} not found`);
  }
  const persisted = sanitizeRelayStrings(user.userRelays);
  const publishRelaySource: PublishRelaySourceDb =
    user.publishRelaySource === "nip65_profile" ? "nip65_profile" : "app";
  return {
    appRelays: persisted,
    publishRelaySource,
    npub: user.npub,
  };
}

export async function isBlastrEnabledForUserFromDb(
  userId: string
): Promise<boolean> {
  const [user, subscription] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { blastrRelayEnabled: true },
    }),
    prisma.subscription.findUnique({
      where: { userId },
      include: { Plan: true },
    }),
  ]);

  return !!(
    user?.blastrRelayEnabled === true &&
    subscription?.status === "ACTIVE" &&
    subscription.Plan?.enableRelayBlast
  );
}
