/**
 * User queries data access. Prisma confined to feature repositories/ per architecture.
 */

import type { User } from "@prisma/client";

import { prisma } from "~/lib/prisma.server";

export async function findUserBasicInfo(userId: string): Promise<{
  npub: string | null;
  isChild: boolean;
  parentNpub: string | null;
} | null> {
  return await prisma.user.findUnique({
    where: { id: userId },
    select: { npub: true, isChild: true, parentNpub: true },
  });
}

export async function findUsersByNpubs(npubs: string[]): Promise<
  Array<{
    npub: string;
    nostrProfile: unknown;
  }>
> {
  if (!npubs.length) return [];
  return prisma.user.findMany({
    where: { npub: { in: npubs } },
    select: { npub: true, nostrProfile: true },
  });
}

export async function findUserByNpubSelectProfile(
  npub: string
): Promise<{ npub: string; nostrProfile: unknown } | null> {
  return prisma.user.findUnique({
    where: { npub },
    select: { npub: true, nostrProfile: true },
  });
}

export async function findUserIdByNpub(npub: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { npub },
    select: { id: true },
  });
  return user?.id ?? null;
}

export function countUsers(): Promise<number> {
  return prisma.user.count();
}

export async function findEnabledUsersWithSubscriptions() {
  return prisma.user.findMany({
    where: { isEnabled: true },
    include: {
      Subscription: { include: { Plan: true } },
    },
  });
}

export function updateUserDisabled(userId: string): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: { isEnabled: false },
  });
}
