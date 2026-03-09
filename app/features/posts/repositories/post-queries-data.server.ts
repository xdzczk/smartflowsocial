/**
 * Post queries and updates data. Prisma confined to feature repositories.
 */

import type { Prisma } from "@prisma/client";

import type { Post } from "~/features/posts/data/posts-prisma-types.server";
import { prisma } from "~/lib/prisma.server";

export async function findPostById(id: string): Promise<Post | null> {
  return prisma.post.findUnique({
    where: { id },
  });
}

export async function findPostByIdAndUser(
  id: string,
  userId: string,
  select?: {
    content?: boolean;
    caption?: boolean;
    fileUrl?: boolean;
    queueTypeId?: boolean;
    draftMeta?: boolean;
  }
) {
  if (select) {
    return prisma.post.findUnique({
      where: { id, userId },
      select: { id: true, ...select },
    });
  }
  return prisma.post.findUnique({
    where: { id, userId },
  });
}

export async function findPostByCreationIdempotencyKey(
  creationIdempotencyKey: string
): Promise<{ existing: Post | null; columnExists: boolean }> {
  let _columnExists = true;
  try {
    const rawResults = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM "Post" WHERE "creationIdempotencyKey" = $1 LIMIT 1`,
      creationIdempotencyKey
    );
    if (rawResults.length === 0) {
      return { existing: null, columnExists: true };
    }
    const first = rawResults[0];
    if (!first) return { existing: null, columnExists: true };
    const existing = await prisma.post.findUnique({
      where: { id: first.id },
    });
    return { existing, columnExists: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    const str = String(error);
    const isColumnError =
      msg.includes("does not exist") ||
      msg.includes("column") ||
      str.includes("does not exist") ||
      str.includes("column") ||
      str.includes("(not available)");
    if (isColumnError) {
      _columnExists = false;
      return { existing: null, columnExists: false };
    }
    throw error;
  }
}

export async function updatePost(
  postId: string,
  userId: string,
  data: Parameters<typeof prisma.post.update>[0]["data"]
) {
  return prisma.post.update({
    where: { id: postId, userId },
    data,
  });
}

export async function deletePostsByDraftGroupId(
  groupId: string,
  userId: string
) {
  return prisma.post.deleteMany({
    where: { draftGroupId: groupId, userId },
  });
}

export async function findFirstPost(where: Prisma.PostWhereInput) {
  return prisma.post.findFirst({ where });
}

export async function findManyPosts(
  where: Prisma.PostWhereInput,
  options?: {
    orderBy?: object;
    include?: object;
    select?: object;
    take?: number;
  }
) {
  return prisma.post.findMany({ where, ...options });
}

/** Generic findUnique for queue-handlers and other callers that need custom include/select. */
export function findPostUnique(
  where: { id: string; userId?: string },
  options?: { include?: object; select?: object }
) {
  return prisma.post.findUnique({
    where: where.userId
      ? { id: where.id, userId: where.userId }
      : { id: where.id },
    ...options,
  });
}
