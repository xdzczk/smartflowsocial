/**
 * NWC (Nostr Wallet Connect) data access. Prisma confined to feature repositories/ per architecture.
 */

import type { User } from "@prisma/client";

import { prisma } from "~/lib/prisma.server";

export function updateUserNwc(
  userId: string,
  data: {
    encryptedNwc: string;
    nwcEnabled: boolean;
    nwcLastUsed: Date;
  }
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data,
  });
}

export function updateUserNwcEnabled(
  userId: string,
  nwcEnabled: boolean,
  nwcLastUsed?: Date
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: { nwcEnabled, ...(nwcLastUsed && { nwcLastUsed }) },
  });
}

export function clearUserNwc(userId: string): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: { encryptedNwc: null, nwcEnabled: false, nwcLastUsed: null },
  });
}

export async function findUserNwcFields(userId: string): Promise<{
  nwcEnabled: boolean;
  encryptedNwc: string | null;
  nwcLastUsed: Date | null;
} | null> {
  return await prisma.user.findUnique({
    where: { id: userId },
    select: { nwcEnabled: true, encryptedNwc: true, nwcLastUsed: true },
  });
}

export async function findUserEncryptedNwc(
  userId: string
): Promise<{ encryptedNwc: string | null; nwcEnabled: boolean } | null> {
  return await prisma.user.findUnique({
    where: { id: userId },
    select: { encryptedNwc: true, nwcEnabled: true },
  });
}

/** Bump last-used timestamp after a successful NWC payment (e.g. zap). */
export function touchUserNwcLastUsed(userId: string): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: { nwcLastUsed: new Date() },
  });
}
