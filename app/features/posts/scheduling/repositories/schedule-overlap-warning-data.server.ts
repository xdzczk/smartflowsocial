import { prisma } from "~/lib/prisma.server";

interface ScheduledCandidateRecord {
  id: string;
  scheduledAtUtc: Date;
  queueTypeId: string | null;
}

interface FindScheduledCandidatesInput {
  userId: string;
  rangeStart: Date;
  rangeEnd: Date;
  excludeContentId?: string | null;
}

export async function findScheduledCandidatesNearTime({
  userId,
  rangeStart,
  rangeEnd,
  excludeContentId = null,
}: FindScheduledCandidatesInput): Promise<ScheduledCandidateRecord[]> {
  const [postCandidates, longFormCandidates] = await Promise.all([
    prisma.post.findMany({
      where: {
        userId,
        currentState: "SCHEDULED",
        ...(excludeContentId ? { id: { not: excludeContentId } } : {}),
        scheduledAtUtc: {
          gte: rangeStart,
          lte: rangeEnd,
        },
      },
      select: {
        id: true,
        scheduledAtUtc: true,
        queueTypeId: true,
      },
    }),
    prisma.longFormPost.findMany({
      where: {
        userId,
        currentState: "SCHEDULED",
        ...(excludeContentId ? { id: { not: excludeContentId } } : {}),
        scheduledAtUtc: {
          gte: rangeStart,
          lte: rangeEnd,
        },
      },
      select: {
        id: true,
        scheduledAtUtc: true,
        queueTypeId: true,
      },
    }),
  ]);

  return [...postCandidates, ...longFormCandidates].filter(
    (
      candidate
    ): candidate is {
      id: string;
      scheduledAtUtc: Date;
      queueTypeId: string | null;
    } => candidate.scheduledAtUtc instanceof Date
  );
}
