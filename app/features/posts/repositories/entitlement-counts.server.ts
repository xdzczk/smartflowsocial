/**
 * Counts for plan entitlement checks (draft / schedule caps).
 */
import { prisma } from "~/lib/prisma.server";

export async function countDraftItemsForUser(userId: string): Promise<number> {
  const [shortCount, longCount] = await Promise.all([
    prisma.post.count({ where: { userId, currentState: "DRAFT" } }),
    prisma.longFormPost.count({ where: { userId, currentState: "DRAFT" } }),
  ]);
  return shortCount + longCount;
}

export async function countTemplatesForUser(userId: string): Promise<number> {
  return prisma.template.count({ where: { userId } });
}

export async function countFutureScheduledItemsForUser(
  userId: string
): Promise<number> {
  const now = new Date();
  const [postCount, longformCount] = await Promise.all([
    prisma.post.count({
      where: {
        userId,
        currentState: "SCHEDULED",
        scheduledAtUtc: { gt: now },
      },
    }),
    prisma.longFormPost.count({
      where: {
        userId,
        currentState: "SCHEDULED",
        scheduledAtUtc: { gt: now },
      },
    }),
  ]);
  return postCount + longformCount;
}
