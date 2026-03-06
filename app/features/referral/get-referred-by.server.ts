/**
 * Get referrer info when current user was referred (for one-time thank-you message).
 */

import { prisma } from "~/lib/prisma.server";

function displayNameFromProfile(nostrProfile: unknown): string | null {
  if (!nostrProfile || typeof nostrProfile !== "object") return null;
  const p = nostrProfile as Record<string, unknown>;
  const name = p["name"] ?? p["display_name"] ?? p["displayName"];
  return typeof name === "string" ? name : null;
}

export async function getReferredByForNpub(referredNpub: string): Promise<{
  referrerNpub: string;
  referrerDisplayName: string | null;
} | null> {
  const referral = await prisma.referral.findUnique({
    where: { referredNpub },
    select: { referrerNpub: true },
  });
  if (!referral) return null;

  const referrerUser = await prisma.user.findUnique({
    where: { npub: referral.referrerNpub },
    select: { nostrProfile: true },
  });

  const referrerDisplayName = referrerUser?.nostrProfile
    ? displayNameFromProfile(referrerUser.nostrProfile)
    : null;

  return {
    referrerNpub: referral.referrerNpub,
    referrerDisplayName,
  };
}
