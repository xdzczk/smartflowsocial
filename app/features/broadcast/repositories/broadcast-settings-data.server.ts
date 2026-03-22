/**
 * User broadcast settings — Prisma confined to repositories.
 */

import type { Prisma } from "@prisma/client";

import { prisma } from "~/lib/prisma.server";

export async function findUserBroadcastSettings(
  userId: string
): Promise<Prisma.JsonValue | null> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { broadcastSettings: true },
  });
  return row?.broadcastSettings ?? null;
}

export async function updateUserBroadcastSettings(
  userId: string,
  settings: Prisma.InputJsonValue
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { broadcastSettings: settings },
  });
}
