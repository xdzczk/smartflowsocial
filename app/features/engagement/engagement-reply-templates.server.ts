/**
 * Server functions for engagement reply templates (CRUD).
 */

import type { PrismaClient } from "@prisma/client";

import { prisma } from "~/lib/prisma.server";

const db = prisma as unknown as PrismaClient;

export interface ReplyTemplateRecord {
  id: string;
  slug: string;
  body: string;
}

export async function listReplyTemplates(
  userId: string
): Promise<ReplyTemplateRecord[]> {
  return await db.engagementReplyTemplate.findMany({
    where: { userId },
    orderBy: { slug: "asc" },
    select: { id: true, slug: true, body: true },
  });
}

export async function createReplyTemplate(
  userId: string,
  slug: string,
  body: string
): Promise<{ success: boolean; error?: string }> {
  const s = slug.trim().toLowerCase().replace(/\s+/g, "-");
  if (!s) return { success: false, error: "Slug is required" };
  try {
    await db.engagementReplyTemplate.create({
      data: { userId, slug: s, body: body.trim() },
    });
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Failed to create template",
    };
  }
}

export async function deleteReplyTemplate(
  userId: string,
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const existing = await db.engagementReplyTemplate.findFirst({
      where: { id, userId },
    });
    if (!existing) return { success: false, error: "Not found" };
    await db.engagementReplyTemplate.delete({ where: { id } });
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete template" };
  }
}
