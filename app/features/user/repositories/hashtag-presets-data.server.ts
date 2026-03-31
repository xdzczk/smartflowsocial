/**
 * Hashtag presets and related user settings data access. Prisma confined to repositories/ per architecture.
 */

import type { HashTagPreset, User } from "@prisma/client";

import { prisma } from "~/lib/prisma.server";

export function createHashTagPreset(data: {
  userId: string;
  name: string;
  tags: string;
  description?: string;
}): Promise<HashTagPreset> {
  return prisma.hashTagPreset.create({
    data: {
      userId: data.userId,
      name: data.name.trim(),
      tags: data.tags.trim(),
      description: data.description?.trim(),
    },
  });
}

export function updateHashTagPreset(
  userId: string,
  id: string,
  data: { name: string; tags: string; description?: string }
): Promise<HashTagPreset> {
  return prisma.hashTagPreset.update({
    where: { id, userId },
    data: {
      name: data.name.trim(),
      tags: data.tags.trim(),
      description: data.description?.trim(),
    },
  });
}

export async function deleteHashTagPreset(
  userId: string,
  id: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.queueType.updateMany({
      where: { userId, hashTagPresetId: id },
      data: { hashTagPresetId: null },
    });
    await tx.post.updateMany({
      where: { userId, hashTagPresetId: id },
      data: { hashTagPresetId: null },
    });
    await tx.longFormPost.updateMany({
      where: { userId, hashTagPresetId: id },
      data: { hashTagPresetId: null },
    });
    await tx.hashTagPreset.delete({
      where: { id, userId },
    });
  });
}

export function findHashTagPresetsByUserId(
  userId: string
): Promise<HashTagPreset[]> {
  return prisma.hashTagPreset.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
}

export function findHashTagPresetByIdAndUserId(
  userId: string,
  id: string
): Promise<HashTagPreset | null> {
  return prisma.hashTagPreset.findFirst({
    where: { id, userId },
  });
}

export async function findHashTagPresetExists(
  userId: string,
  presetId: string
): Promise<boolean> {
  const p = await prisma.hashTagPreset.findFirst({
    where: { id: presetId, userId },
  });
  return !!p;
}

export function updateUserShowHashTagsInPosts(
  userId: string,
  showHashTagsInPosts: boolean
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: { showHashTagsinPosts: showHashTagsInPosts },
  });
}

export async function findUserShowHashTagsInPosts(
  userId: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { showHashTagsinPosts: true },
  });
  return user?.showHashTagsinPosts ?? false;
}
