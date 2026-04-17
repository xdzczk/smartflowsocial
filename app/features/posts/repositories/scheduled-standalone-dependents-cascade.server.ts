/**
 * Deletes standalone scheduled reposts/quotes that reference a given source post
 * via `repostOfPostId` or `quoteOfPostId` (as opposed to the "attached" tree
 * handled by {@link cascadeDeleteAttachedFollowups}).
 */

import { cancelPostJob } from "~/infra/queue/queue-operations.server";
import { prisma } from "~/lib/prisma.server";

export async function cascadeDeleteStandaloneScheduledDependents(
  postId: string,
  userId: string
): Promise<string[]> {
  const dependents = await prisma.post.findMany({
    where: {
      userId,
      currentState: "SCHEDULED",
      OR: [{ repostOfPostId: postId }, { quoteOfPostId: postId }],
    },
    select: { id: true },
  });
  if (dependents.length === 0) return [];
  const ids = dependents.map((d) => d.id);
  await prisma.post.deleteMany({ where: { id: { in: ids }, userId } });
  await Promise.all(ids.map((id) => cancelPostJob(id)));
  return ids;
}
