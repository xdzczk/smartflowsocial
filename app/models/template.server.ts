import { prisma } from "~/lib/prisma.server";

export async function createTemplate({
  userId,
  name,
  postIds,
}: {
  userId: string;
  name: string;
  postIds: string[];
}) {
  return prisma.template.create({
    data: {
      userId,
      name,
      posts: {
        connect: postIds.map((id) => ({ id })),
      },
    },
    include: {
      posts: true,
    },
  });
}

export async function getTemplates({ userId }: { userId: string }) {
  return prisma.template.findMany({
    where: { userId },
    include: {
      posts: true,
    },
    orderBy: {
      createdAt: "desc",
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
      posts: true,
    },
  });
}

export async function updateTemplate({
  id,
  userId,
  name,
  postIds,
}: {
  id: string;
  userId: string;
  name?: string;
  postIds?: string[];
}) {
  const updateData: any = {};
  if (name !== undefined) updateData.name = name;
  if (postIds !== undefined) {
    updateData.posts = {
      set: postIds.map((id) => ({ id })),
    };
  }

  return prisma.template.update({
    where: { id, userId },
    data: updateData,
    include: {
      posts: true,
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

export async function removePostFromTemplate({
  templateId,
  postId,
  userId,
}: {
  templateId: string;
  postId: string;
  userId: string;
}) {
  return prisma.template.update({
    where: { id: templateId, userId },
    data: {
      posts: {
        disconnect: { id: postId },
      },
    },
    include: {
      posts: true,
    },
  });
}
