/**
 * Draft groups and versions data. Prisma confined to feature repositories.
 */

import { prisma } from "~/lib/prisma.server";

export const DRAFT_GROUP_VERSION_LIMIT = 20;

export async function findDraftGroupsWithDraftPosts(userId: string) {
  return prisma.draftGroup.findMany({
    where: { userId },
    include: {
      _count: { select: { posts: true } },
      posts: {
        where: { currentState: "DRAFT" },
        take: 1,
        select: { id: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function findDraftGroupByIdAndUser(
  groupId: string,
  userId: string
) {
  return prisma.draftGroup.findFirst({
    where: { id: groupId, userId },
  });
}

export async function createDraftGroup(userId: string) {
  return prisma.draftGroup.create({
    data: { userId },
  });
}

export async function updateDraftGroup(
  groupId: string,
  userId: string,
  data: { updatedAt?: Date }
) {
  return prisma.draftGroup.update({
    where: { id: groupId, userId },
    data,
  });
}

export async function getNextDraftGroupVersion(draftGroupId: string) {
  return prisma.draftGroupVersion.aggregate({
    where: { draftGroupId },
    _max: { version: true },
  });
}

export async function createDraftGroupVersionRow(data: {
  draftGroupId: string;
  version: number;
  snapshot: object;
  createdBy: string;
}) {
  return prisma.draftGroupVersion.create({
    data: {
      draftGroupId: data.draftGroupId,
      version: data.version,
      snapshot: data.snapshot,
      createdBy: data.createdBy,
    },
  });
}

export async function findDraftGroupVersionIds(draftGroupId: string) {
  return prisma.draftGroupVersion.findMany({
    where: { draftGroupId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
}

export async function deleteDraftGroupVersionsByIds(ids: string[]) {
  if (ids.length === 0) return;
  return prisma.draftGroupVersion.deleteMany({
    where: { id: { in: ids } },
  });
}

export async function findPostsByDraftGroupId(groupId: string, userId: string) {
  return prisma.post.findMany({
    where: { draftGroupId: groupId, userId },
    orderBy: { createdAt: "asc" },
    include: { queueType: true },
  });
}
