import type { AssetType, Prisma } from "@prisma/client";

import { prisma } from "~/lib/prisma.server";

export async function createAsset({
  userId,
  title,
  content,
  fileUrl,
  tags,
  assetType,
}: {
  userId: string;
  title?: string;
  content?: string;
  fileUrl?: string;
  tags?: string[];
  assetType: AssetType;
}) {
  return prisma.asset.create({
    data: {
      userId,
      title,
      content,
      fileUrl,
      tags: tags || [],
      assetType,
    },
  });
}

export async function getAssets({
  userId,
  page = 1,
  limit = 100,
}: {
  userId: string;
  page?: number;
  limit?: number;
}) {
  const skip = (page - 1) * limit;

  const [assets, totalCount] = await Promise.all([
    prisma.asset.findMany({
      where: { userId },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    }),
    prisma.asset.count({
      where: { userId },
    }),
  ]);

  return {
    assets,
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
    currentPage: page,
  };
}

export async function getAssetById({
  id,
  userId,
}: {
  id: string;
  userId: string;
}) {
  return prisma.asset.findFirst({
    where: { id, userId },
  });
}

export async function updateAsset({
  id,
  userId,
  title,
  content,
  fileUrl,
  tags,
}: {
  id: string;
  userId: string;
  title?: string;
  content?: string;
  fileUrl?: string;
  tags?: string[];
}) {
  const updateData: Partial<{
    title?: string;
    content?: string;
    fileUrl?: string;
    tags?: string[];
  }> = {};
  if (title !== undefined) updateData.title = title;
  if (content !== undefined) updateData.content = content;
  if (fileUrl !== undefined) updateData.fileUrl = fileUrl;
  if (tags !== undefined) updateData.tags = tags;

  return prisma.asset.update({
    where: { id, userId },
    data: updateData,
  });
}

export async function deleteAsset({
  id,
  userId,
}: {
  id: string;
  userId: string;
}) {
  return prisma.asset.delete({
    where: { id, userId },
  });
}

export async function getAssetsByType({
  userId,
  assetType,
}: {
  userId: string;
  assetType: AssetType;
}) {
  return prisma.asset.findMany({
    where: { userId, assetType },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function searchAssets({
  userId,
  searchTerm,
  page = 1,
  limit = 100,
}: {
  userId: string;
  searchTerm: string;
  page?: number;
  limit?: number;
}) {
  const searchWords = searchTerm.toLowerCase().split(" ").filter(Boolean);
  const skip = (page - 1) * limit;

  const whereClause: Prisma.AssetWhereInput = {
    userId,
    OR: [
      {
        title: {
          contains: searchTerm,
          mode: "insensitive" as Prisma.QueryMode,
        },
      },
      {
        content: {
          contains: searchTerm,
          mode: "insensitive" as Prisma.QueryMode,
        },
      },
      {
        tags: {
          hasSome: searchWords,
        },
      },
    ],
  };

  const [assets, totalCount] = await Promise.all([
    prisma.asset.findMany({
      where: whereClause,
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    }),
    prisma.asset.count({
      where: whereClause,
    }),
  ]);

  return {
    assets,
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
    currentPage: page,
  };
}
