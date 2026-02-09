/**
 * Bulk draft groups: create/update DraftGroup, list groups with DRAFT posts, load group posts, versioning.
 */

import { prisma } from "~/lib/prisma.server";

export const DRAFT_GROUP_VERSION_LIMIT = 20;

export interface BulkDraftGroupSummary {
  id: string;
  postCount: number;
  updatedAt: Date;
}

/**
 * List bulk draft groups for a user: groups that have at least one Post with currentState "DRAFT".
 */
export async function listBulkDraftGroups(
  userId: string
): Promise<BulkDraftGroupSummary[]> {
  const groups = await prisma.draftGroup.findMany({
    where: { userId },
    include: {
      _count: {
        select: {
          posts: true,
        },
      },
      posts: {
        where: { currentState: "DRAFT" },
        take: 1,
        select: { id: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const withDraft = groups.filter((g) => g.posts.length > 0);
  return withDraft.map((g) => ({
    id: g.id,
    postCount: g._count.posts,
    updatedAt: g.updatedAt,
  }));
}

/**
 * Get or create a draft group. If groupId provided and valid for user, return it; else create new.
 */
export async function getOrCreateDraftGroup(
  userId: string,
  groupId: string | null
): Promise<{ groupId: string }> {
  if (groupId) {
    const existing = await prisma.draftGroup.findFirst({
      where: { id: groupId, userId },
    });
    if (existing) return { groupId: existing.id };
  }
  const created = await prisma.draftGroup.create({
    data: { userId },
  });
  return { groupId: created.id };
}

/**
 * Delete all posts in a draft group (before replacing with new rows on re-save).
 */
export async function deleteDraftGroupPosts(
  groupId: string,
  userId: string
): Promise<void> {
  await prisma.post.deleteMany({
    where: { draftGroupId: groupId, userId },
  });
}

/**
 * Snapshot row shape for DraftGroupVersion (stable for restore).
 */
export interface BulkDraftSnapshotRow {
  caption: string;
  fileUrl: string[];
  queueTypeId: string | null;
  scheduledFor: string | null;
  sortOrder?: number;
  isRecyclable?: boolean;
}

/**
 * Create a DraftGroupVersion and prune old versions beyond limit.
 */
export async function createDraftGroupVersion(
  draftGroupId: string,
  snapshot: BulkDraftSnapshotRow[],
  userId: string
): Promise<void> {
  const next = await prisma.draftGroupVersion.aggregate({
    where: { draftGroupId },
    _max: { version: true },
  });
  const version = (next._max.version ?? 0) + 1;
  await prisma.draftGroupVersion.create({
    data: {
      draftGroupId,
      version,
      snapshot: snapshot as unknown as object,
      createdBy: userId,
    },
  });
  const versions = await prisma.draftGroupVersion.findMany({
    where: { draftGroupId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (versions.length > DRAFT_GROUP_VERSION_LIMIT) {
    const toDelete = versions.slice(
      0,
      versions.length - DRAFT_GROUP_VERSION_LIMIT
    );
    await prisma.draftGroupVersion.deleteMany({
      where: { id: { in: toDelete.map((v) => v.id) } },
    });
  }
}

/**
 * Load posts belonging to a bulk draft group (for opening in BulkPostsPage).
 */
export async function getBulkDraftGroupPosts(groupId: string, userId: string) {
  return prisma.post.findMany({
    where: { draftGroupId: groupId, userId },
    orderBy: { createdAt: "asc" },
    include: {
      queueType: true,
    },
  });
}
