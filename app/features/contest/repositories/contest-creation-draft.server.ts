/**
 * Contest creation draft persistence (builder autosave).
 */

import { prisma } from "~/lib/prisma.server";

export async function findContestCreationDraftByUserId(userId: string) {
  return prisma.contestCreationDraft.findUnique({ where: { userId } });
}

export async function upsertContestCreationDraftPayload(
  userId: string,
  payload: Record<string, unknown>
): Promise<void> {
  await prisma.contestCreationDraft.upsert({
    where: { userId },
    create: { userId, payload },
    update: { payload },
  });
}
