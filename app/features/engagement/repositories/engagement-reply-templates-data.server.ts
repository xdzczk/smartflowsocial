/**
 * Engagement reply templates data access. Prisma confined to feature repositories/ per architecture.
 */

import type { PrismaClient } from "@prisma/client";

import { prisma } from "~/lib/prisma.server";

const db = prisma as unknown as PrismaClient;

export interface ReplyTemplateRecord {
  id: string;
  slug: string;
  body: string;
}

export async function findManyReplyTemplatesByUserId(
  userId: string
): Promise<ReplyTemplateRecord[]> {
  return db.engagementReplyTemplate.findMany({
    where: { userId },
    orderBy: { slug: "asc" },
    select: { id: true, slug: true, body: true },
  });
}

export async function createReplyTemplate(
  userId: string,
  slug: string,
  body: string
): Promise<void> {
  await db.engagementReplyTemplate.create({
    data: { userId, slug, body },
  });
}

export async function deleteReplyTemplateByIdAndUserId(
  id: string,
  userId: string
): Promise<boolean> {
  const existing = await db.engagementReplyTemplate.findFirst({
    where: { id, userId },
  });
  if (!existing) return false;
  await db.engagementReplyTemplate.delete({ where: { id } });
  return true;
}

export async function updateReplyTemplateByIdAndUserId(
  id: string,
  userId: string,
  slug: string,
  body: string
): Promise<boolean> {
  const result = await db.engagementReplyTemplate.updateMany({
    where: { id, userId },
    data: { slug, body },
  });
  return result.count > 0;
}
