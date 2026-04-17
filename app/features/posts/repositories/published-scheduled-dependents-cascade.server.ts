/**
 * Deletes scheduled reposts/quotes that depend on a published source post.
 * Prisma access is confined to repositories per feature import rules.
 */

import { cancelPostJob } from "~/infra/queue/queue-operations.server";
import { prisma } from "~/lib/prisma.server";

export async function cascadeDeleteScheduledDependentsForSourcePost(
  postId: string,
  userId: string
): Promise<void> {
  const dependents = await prisma.post.findMany({
    where: {
      userId,
      currentState: "SCHEDULED",
      OR: [{ repostOfPostId: postId }, { quoteOfPostId: postId }],
    },
    select: { id: true },
  });
  if (dependents.length === 0) return;
  const ids = dependents.map((d) => d.id);
  await prisma.post.deleteMany({ where: { id: { in: ids }, userId } });
  await Promise.all(ids.map((id) => cancelPostJob(id)));
}
