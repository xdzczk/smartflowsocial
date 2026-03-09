/**
 * Draft versioning: create, list, restore snapshots for short and longform drafts.
 * Short: snapshot in JSON. Longform: gzipped JSON in snapshotCompressed.
 */

import zlib from "node:zlib";

import { z } from "zod";

import {
  createDraftVersionLongform,
  createDraftVersionShort,
  deleteDraftVersionsByIds,
  findDraftVersionByIdForRestore,
  findDraftVersionByIdForSnapshot,
  findDraftVersionsByLongFormPostId,
  findDraftVersionsByPostId,
  findDraftVersionIdsByLongFormPostId,
  findDraftVersionIdsByPostId,
  findLongFormDraftByIdAndUser,
  findPostDraftByIdAndUser,
  getNextDraftVersionForLongForm,
  getNextDraftVersionForPost,
  updateLongFormPostDraftContent,
  updatePostDraftContent,
} from "../../repositories/draft-version-data.server";

export const VERSION_LIMIT = 20;
export const SHORT_SNAPSHOT_SCHEMA_VERSION = 1;
export const LONGFORM_SNAPSHOT_SCHEMA_VERSION = 1;

/** Stable snapshot shape for short post (schema versioned for future migrations). */
export const shortSnapshotSchema = z.object({
  schemaVersion: z.number(),
  content: z.string().nullable(),
  caption: z.string().nullable(),
  fileUrl: z.array(z.string()),
  queueTypeId: z.string().nullable(),
  draftMeta: z.unknown().nullable(),
});
export type ShortSnapshot = z.infer<typeof shortSnapshotSchema>;

/** Stable snapshot shape for longform (schema versioned). */
export const longformSnapshotSchema = z.object({
  schemaVersion: z.number(),
  title: z.string().nullable(),
  summary: z.string().nullable(),
  content: z.string().nullable(),
  image: z.string().nullable(),
  tags: z.array(z.string()),
  queueTypeId: z.string().nullable(),
});
export type LongformSnapshot = z.infer<typeof longformSnapshotSchema>;

async function getNextVersion(
  postId: string | null,
  longFormPostId: string | null
): Promise<number> {
  if (postId) return getNextDraftVersionForPost(postId);
  if (longFormPostId) return getNextDraftVersionForLongForm(longFormPostId);
  return 1;
}

async function deleteOldVersionsBeyondLimit(
  postId: string | null,
  longFormPostId: string | null,
  limit: number
): Promise<void> {
  if (postId) {
    const versions = await findDraftVersionIdsByPostId(postId);
    if (versions.length > limit) {
      const toDelete = versions.slice(0, versions.length - limit);
      await deleteDraftVersionsByIds(toDelete.map((v) => v.id));
    }
    return;
  }
  if (longFormPostId) {
    const versions = await findDraftVersionIdsByLongFormPostId(longFormPostId);
    if (versions.length > limit) {
      const toDelete = versions.slice(0, versions.length - limit);
      await deleteDraftVersionsByIds(toDelete.map((v) => v.id));
    }
  }
}

/**
 * Create a draft version for a short post. Snapshot stored as JSON.
 */
export async function createShortDraftVersion(
  postId: string,
  snapshot: ShortSnapshot,
  userId: string
): Promise<void> {
  const version = await getNextVersion(postId, null);
  await createDraftVersionShort({
    postId,
    version,
    snapshot: snapshot as unknown as object,
    createdBy: userId,
  });
  await deleteOldVersionsBeyondLimit(postId, null, VERSION_LIMIT);
}

/**
 * Create a draft version for a longform post. Snapshot stored gzipped.
 */
export async function createLongformDraftVersion(
  longFormPostId: string,
  snapshot: LongformSnapshot,
  userId: string
): Promise<void> {
  const version = await getNextVersion(null, longFormPostId);
  const json = JSON.stringify(snapshot);
  const compressed = zlib.gzipSync(Buffer.from(json, "utf-8"));
  await createDraftVersionLongform({
    longFormPostId,
    version,
    snapshotCompressed: compressed,
    createdBy: userId,
  });
  await deleteOldVersionsBeyondLimit(null, longFormPostId, VERSION_LIMIT);
}

export interface DraftVersionListItem {
  id: string;
  version: number;
  createdAt: Date;
  createdBy: string | null;
}

/**
 * List versions for a short post or longform post.
 */
export async function getDraftVersions(
  postId: string | null,
  longFormPostId: string | null
): Promise<DraftVersionListItem[]> {
  if (postId != null) return findDraftVersionsByPostId(postId);
  if (longFormPostId != null)
    return findDraftVersionsByLongFormPostId(longFormPostId);
  return [];
}

/**
 * Load a version's snapshot. For longform, decompresses snapshotCompressed.
 */
export async function getVersionSnapshot(
  versionId: string
): Promise<ShortSnapshot | LongformSnapshot | null> {
  const row = await findDraftVersionByIdForSnapshot(versionId);
  if (!row) return null;
  if (row.snapshotCompressed && row.snapshotCompressed.length > 0) {
    const buf = zlib.gunzipSync(Buffer.from(row.snapshotCompressed));
    const json = buf.toString("utf-8");
    const parsed = JSON.parse(json) as unknown;
    return longformSnapshotSchema.parse(parsed);
  }
  if (row.snapshot) {
    return shortSnapshotSchema.parse(row.snapshot);
  }
  return null;
}

/**
 * Get version row for restore (need to know if short or longform).
 */
export async function getDraftVersionById(versionId: string) {
  return findDraftVersionByIdForRestore(versionId);
}

/**
 * Restore a short post draft from a version snapshot. Verifies post belongs to userId and is DRAFT.
 * Returns updated post id or null if not found/unauthorized.
 */
export async function restoreShortDraftVersion(
  versionId: string,
  userId: string
): Promise<string | null> {
  const row = await findDraftVersionByIdForRestore(versionId);
  if (!row?.postId || !row.snapshot) return null;
  const snapshot = shortSnapshotSchema.safeParse(row.snapshot);
  if (!snapshot.success) return null;
  const post = await findPostDraftByIdAndUser(row.postId, userId);
  if (!post) return null;
  const data = snapshot.data;
  await updatePostDraftContent(row.postId, userId, {
    content: data.content ?? undefined,
    caption: data.caption ?? undefined,
    fileUrl: data.fileUrl,
    queueTypeId: data.queueTypeId ?? undefined,
    draftMeta: data.draftMeta as object | undefined,
    updatedAt: new Date(),
  });
  return row.postId;
}

/**
 * Restore a longform draft from a version snapshot. Verifies longform belongs to userId and is DRAFT.
 * Returns updated longform post id or null if not found/unauthorized.
 */
export async function restoreLongformDraftVersion(
  versionId: string,
  userId: string
): Promise<string | null> {
  const row = await findDraftVersionByIdForRestore(versionId);
  if (!row?.longFormPostId || !row.snapshotCompressed?.length) return null;
  const buf = zlib.gunzipSync(Buffer.from(row.snapshotCompressed));
  const parsed = JSON.parse(buf.toString("utf-8")) as unknown;
  const snapshot = longformSnapshotSchema.safeParse(parsed);
  if (!snapshot.success) return null;
  const longform = await findLongFormDraftByIdAndUser(
    row.longFormPostId,
    userId
  );
  if (!longform) return null;
  const data = snapshot.data;
  await updateLongFormPostDraftContent(row.longFormPostId, userId, {
    title: data.title ?? undefined,
    summary: data.summary ?? undefined,
    content: data.content ?? undefined,
    image: data.image ?? undefined,
    tags: data.tags,
    queueTypeId: data.queueTypeId ?? undefined,
    updatedAt: new Date(),
  });
  return row.longFormPostId;
}
