/**
 * DraftVersion (per-post/longform snapshot) data. Prisma confined here.
 */

import { Prisma } from "~/features/posts/data/posts-prisma-types.server";
import { prisma } from "~/lib/prisma.server";

export async function getNextDraftVersionForPost(postId: string) {
  const r = await prisma.draftVersion.aggregate({
    where: { postId },
    _max: { version: true },
  });
  return (r._max.version ?? 0) + 1;
}

export async function getNextDraftVersionForLongForm(longFormPostId: string) {
  const r = await prisma.draftVersion.aggregate({
    where: { longFormPostId },
    _max: { version: true },
  });
  return (r._max.version ?? 0) + 1;
}

export async function findDraftVersionIdsByPostId(postId: string) {
  return prisma.draftVersion.findMany({
    where: { postId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
}

export async function findDraftVersionIdsByLongFormPostId(
  longFormPostId: string
) {
  return prisma.draftVersion.findMany({
    where: { longFormPostId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
}

export async function deleteDraftVersionsByIds(ids: string[]) {
  if (ids.length === 0) return;
  return prisma.draftVersion.deleteMany({
    where: { id: { in: ids } },
  });
}

export async function createDraftVersionShort(data: {
  postId: string;
  version: number;
  snapshot: object;
  createdBy?: string;
}) {
  return prisma.draftVersion.create({
    data: {
      postId: data.postId,
      version: data.version,
      snapshot: data.snapshot,
      createdBy: data.createdBy ?? null,
    },
  });
}

export async function createDraftVersionLongform(data: {
  longFormPostId: string;
  version: number;
  snapshotCompressed: Buffer;
  createdBy?: string;
}) {
  return prisma.draftVersion.create({
    data: {
      longFormPostId: data.longFormPostId,
      version: data.version,
      snapshotCompressed: new Uint8Array(data.snapshotCompressed),
      snapshot: Prisma.JsonNull,
      createdBy: data.createdBy ?? null,
    },
  });
}

export async function findDraftVersionsByPostId(postId: string) {
  return prisma.draftVersion.findMany({
    where: { postId },
    orderBy: { version: "desc" },
    select: { id: true, version: true, createdAt: true, createdBy: true },
  });
}

export async function findDraftVersionsByLongFormPostId(
  longFormPostId: string
) {
  return prisma.draftVersion.findMany({
    where: { longFormPostId },
    orderBy: { version: "desc" },
    select: { id: true, version: true, createdAt: true, createdBy: true },
  });
}

export async function findDraftVersionById(id: string) {
  return prisma.draftVersion.findUnique({
    where: { id },
  });
}

export async function findDraftVersionByIdForSnapshot(id: string) {
  return prisma.draftVersion.findUnique({
    where: { id },
    select: { snapshot: true, snapshotCompressed: true, postId: true },
  });
}

export async function findDraftVersionByIdForRestore(id: string) {
  return prisma.draftVersion.findUnique({
    where: { id },
    select: {
      id: true,
      postId: true,
      longFormPostId: true,
      version: true,
      snapshot: true,
      snapshotCompressed: true,
    },
  });
}

export async function findPostDraftByIdAndUser(postId: string, userId: string) {
  return prisma.post.findFirst({
    where: { id: postId, userId, currentState: "DRAFT" },
  });
}

export async function updatePostDraftContent(
  postId: string,
  userId: string,
  data: object
) {
  return prisma.post.update({
    where: { id: postId, userId },
    data,
  });
}

export async function findLongFormDraftByIdAndUser(
  longFormPostId: string,
  userId: string
) {
  return prisma.longFormPost.findFirst({
    where: { id: longFormPostId, userId, currentState: "DRAFT" },
  });
}

export async function updateLongFormPostDraftContent(
  longFormPostId: string,
  userId: string,
  data: object
) {
  return prisma.longFormPost.update({
    where: { id: longFormPostId, userId },
    data,
  });
}
