/**
 * Bulk draft groups: create/update DraftGroup, list groups with DRAFT posts, load group posts, versioning.
 */

import {
  createDraftGroup,
  createDraftGroupVersionRow,
  deleteDraftGroupVersionsByIds,
  DRAFT_GROUP_VERSION_LIMIT,
  findDraftGroupByIdAndUser,
  findDraftGroupsWithDraftPosts,
  findDraftGroupVersionIds,
  findPostsByDraftGroupId,
  getNextDraftGroupVersion,
} from "../../repositories/draft-data.server";
import { deletePostsByDraftGroupId } from "../../repositories/post-queries-data.server";

export { DRAFT_GROUP_VERSION_LIMIT } from "../../repositories/draft-data.server";

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
  const groups = await findDraftGroupsWithDraftPosts(userId);
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
    const existing = await findDraftGroupByIdAndUser(groupId, userId);
    if (existing) return { groupId: existing.id };
  }
  const created = await createDraftGroup(userId);
  return { groupId: created.id };
}

/**
 * Delete all posts in a draft group (before replacing with new rows on re-save).
 */
export async function deleteDraftGroupPosts(
  groupId: string,
  userId: string
): Promise<void> {
  await deletePostsByDraftGroupId(groupId, userId);
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
  const next = await getNextDraftGroupVersion(draftGroupId);
  const version = (next._max.version ?? 0) + 1;
  await createDraftGroupVersionRow({
    draftGroupId,
    version,
    snapshot: snapshot,
    createdBy: userId,
  });
  const versions = await findDraftGroupVersionIds(draftGroupId);
  if (versions.length > DRAFT_GROUP_VERSION_LIMIT) {
    const toDelete = versions.slice(
      0,
      versions.length - DRAFT_GROUP_VERSION_LIMIT
    );
    await deleteDraftGroupVersionsByIds(toDelete.map((v) => v.id));
  }
}

/**
 * Load posts belonging to a bulk draft group (for opening in BulkPostsPage).
 */
export async function getBulkDraftGroupPosts(groupId: string, userId: string) {
  return findPostsByDraftGroupId(groupId, userId);
}
