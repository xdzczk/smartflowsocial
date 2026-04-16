/**
 * Template data access. Prisma confined to feature repositories/ per architecture.
 */

import type { TemplateType, Prisma } from "@prisma/client";

import { prisma } from "~/lib/prisma.server";

export async function createTemplate({
  userId,
  name,
  templateType,
  postId,
  longFormPostId,
}: {
  userId: string;
  name: string;
  templateType: TemplateType;
  postId?: string | null;
  longFormPostId?: string | null;
}) {
  const { checkTemplateCapacity } =
    await import("~/features/payments/entitlements/draft-template-cap.server");
  const capErr = await checkTemplateCapacity(userId, 1);
  if (capErr) {
    throw new Error(capErr);
  }

  const data: Prisma.TemplateCreateInput = {
    user: { connect: { id: userId } },
    name,
    templateType,
  };
  if (templateType === "POST" && postId) {
    data.post = { connect: { id: postId } };
  } else if (templateType === "LONGFORM" && longFormPostId) {
    data.longFormPost = { connect: { id: longFormPostId } };
  }

  return prisma.template.create({
    data,
    include: {
      post: true,
      longFormPost: true,
    },
  });
}

export async function getTemplates({ userId }: { userId: string }) {
  return prisma.template.findMany({
    where: { userId },
    include: {
      post: true,
      longFormPost: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
}

export async function getTemplateListSummaries({
  userId,
  templateType,
}: {
  userId: string;
  templateType?: TemplateType;
}) {
  return prisma.template.findMany({
    where: {
      userId,
      ...(templateType ? { templateType } : {}),
    },
    select: {
      id: true,
      name: true,
      templateType: true,
      updatedAt: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
}

export async function getTemplateById({
  id,
  userId,
}: {
  id: string;
  userId: string;
}) {
  return prisma.template.findFirst({
    where: { id, userId },
    include: {
      post: true,
      longFormPost: true,
    },
  });
}

export async function updateTemplate({
  id,
  userId,
  name,
  postId,
  longFormPostId,
}: {
  id: string;
  userId: string;
  name?: string;
  postId?: string | null;
  longFormPostId?: string | null;
}) {
  const updateData: Prisma.TemplateUpdateInput = {};
  if (name !== undefined) updateData.name = name;
  if (postId !== undefined) {
    updateData.post = postId
      ? { connect: { id: postId } }
      : { disconnect: true };
  }
  if (longFormPostId !== undefined) {
    updateData.longFormPost = longFormPostId
      ? { connect: { id: longFormPostId } }
      : { disconnect: true };
  }

  return prisma.template.update({
    where: { id, userId },
    data: updateData,
    include: {
      post: true,
      longFormPost: true,
    },
  });
}

export async function deleteTemplate({
  id,
  userId,
}: {
  id: string;
  userId: string;
}) {
  return prisma.template.delete({
    where: { id, userId },
  });
}
