/**
 * Blastr entitlement sync: after subscription changes, update Blastr so only paid users can publish.
 * Best-effort; logs errors, does not throw.
 */

import { prisma } from "~/lib/prisma.server";

import {
  resolvePubkeyHex,
  syncEntitlement,
} from "./blastr-admin.client.server";

/**
 * Called after subscription is updated (new plan, renewal, or cancel/downgrade).
 * Loads user + subscription + plan; if user enabled, ACTIVE, and plan has enableRelayBlast, syncs "active"; else syncs "expired".
 */
export async function afterSubscriptionUpdated(userId: string): Promise<void> {
  const [user, subscription] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { npub: true, isEnabled: true },
    }),
    prisma.subscription.findUnique({
      where: { userId },
      include: { Plan: true },
    }),
  ]);

  if (!user?.npub) return;

  const pubkeyHex = resolvePubkeyHex(user.npub);
  if (!pubkeyHex) return;

  const isEligible =
    user.isEnabled === true &&
    subscription?.status === "ACTIVE" &&
    subscription.Plan?.enableRelayBlast === true;

  await syncEntitlement(pubkeyHex, isEligible ? "active" : "expired");
}
