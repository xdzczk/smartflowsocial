/**
 * Draft versioning: create, list, restore snapshots for short and longform drafts.
 * Short: snapshot in JSON. Longform: gzipped JSON in snapshotCompressed.
 */

import zlib from "node:zlib";

import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "~/lib/prisma.server";

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

function getNextVersion(
  postId: string | null,
  longFormPostId: string | null
): Promise<number> {
  if (postId) {
    const r = await prisma.draftVersion.aggregate({
      where: { postId },
      _max: { version: true },
    });
    return (r._max.version ?? 0) + 1;
  }
  if (longFormPostId) {
    const r = await prisma.draftVersion.aggregate({
      where: { longFormPostId },
      _max: { version: true },
    });
    return (r._max.version ?? 0) + 1;
  }
  return 1;
}

async function deleteOldVersionsBeyondLimit(
  postId: string | null,
  longFormPostId: string | null,
  limit: number
): Promise<void> {
  if (postId) {
    const versions = await prisma.draftVersion.findMany({
      where: { postId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (versions.length > limit) {
      const toDelete = versions.slice(0, versions.length - limit);
      await prisma.draftVersion.deleteMany({
        where: { id: { in: toDelete.map((v) => v.id) } },
      });
    }
    return;
  }
  if (longFormPostId) {
    const versions = await prisma.draftVersion.findMany({
      where: { longFormPostId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (versions.length > limit) {
      const toDelete = versions.slice(0, versions.length - limit);
      await prisma.draftVersion.deleteMany({
        where: { id: { in: toDelete.map((v) => v.id) } },
      });
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
  await prisma.draftVersion.create({
    data: {
      postId,
      version,
      snapshot: snapshot as unknown as object,
      snapshotCompressed: null,
      createdBy: userId,
    },
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
  await prisma.draftVersion.create({
    data: {
      longFormPostId,
      version,
      snapshot: Prisma.JsonNull,
      snapshotCompressed: compressed,
      createdBy: userId,
    },
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
  const where =
    postId != null
      ? { postId }
      : longFormPostId != null
        ? { longFormPostId }
        : {};
  return await prisma.draftVersion.findMany({
    where,
    orderBy: { version: "desc" },
    select: { id: true, version: true, createdAt: true, createdBy: true },
  });
}

/**
 * Load a version's snapshot. For longform, decompresses snapshotCompressed.
 */
export async function getVersionSnapshot(
  versionId: string
): Promise<ShortSnapshot | LongformSnapshot | null> {
  const row = await prisma.draftVersion.findUnique({
    where: { id: versionId },
    select: { snapshot: true, snapshotCompressed: true, postId: true },
  });
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
  return prisma.draftVersion.findUnique({
    where: { id: versionId },
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

/**
 * Restore a short post draft from a version snapshot. Verifies post belongs to userId and is DRAFT.
 * Returns updated post id or null if not found/unauthorized.
 */
export async function restoreShortDraftVersion(
  versionId: string,
  userId: string
): Promise<string | null> {
  const row = await prisma.draftVersion.findUnique({
    where: { id: versionId },
    select: { postId: true, snapshot: true },
  });
  if (!row?.postId || !row.snapshot) return null;
  const snapshot = shortSnapshotSchema.safeParse(row.snapshot);
  if (!snapshot.success) return null;
  const post = await prisma.post.findFirst({
    where: { id: row.postId, userId, currentState: "DRAFT" },
  });
  if (!post) return null;
  const data = snapshot.data;
  await prisma.post.update({
    where: { id: row.postId, userId },
    data: {
      /* eslint-disable @typescript-eslint/no-unnecessary-condition -- snapshot schema allows null */
      content: data.content ?? undefined,
      caption: data.caption ?? undefined,
      fileUrl: data.fileUrl ?? [],
      queueTypeId: data.queueTypeId ?? undefined,
      draftMeta: (data.draftMeta ?? undefined) as object | undefined,
      /* eslint-enable @typescript-eslint/no-unnecessary-condition */
      updatedAt: new Date(),
    },
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
  const row = await prisma.draftVersion.findUnique({
    where: { id: versionId },
    select: { longFormPostId: true, snapshotCompressed: true },
  });
  if (!row?.longFormPostId || !row.snapshotCompressed?.length) return null;
  const buf = zlib.gunzipSync(Buffer.from(row.snapshotCompressed));
  const parsed = JSON.parse(buf.toString("utf-8")) as unknown;
  const snapshot = longformSnapshotSchema.safeParse(parsed);
  if (!snapshot.success) return null;
  const longform = await prisma.longFormPost.findFirst({
    where: { id: row.longFormPostId, userId, currentState: "DRAFT" },
  });
  if (!longform) return null;
  const data = snapshot.data;
  await prisma.longFormPost.update({
    where: { id: row.longFormPostId, userId },
    data: {
      /* eslint-disable @typescript-eslint/no-unnecessary-condition -- snapshot schema allows null */
      title: data.title ?? undefined,
      summary: data.summary ?? undefined,
      content: data.content ?? undefined,
      image: data.image ?? undefined,
      tags: data.tags ?? [],
      queueTypeId: data.queueTypeId ?? undefined,
      /* eslint-enable @typescript-eslint/no-unnecessary-condition */
      updatedAt: new Date(),
    },
  });
  return row.longFormPostId;
}
