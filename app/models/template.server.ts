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

/**
 * Get prefill data for a template (for loading into New Post or New Longform composer).
 */
export async function getTemplatePrefill({
  id,
  userId,
}: {
  id: string;
  userId: string;
}) {
  const template = await getTemplateById({ id, userId });
  if (!template) return null;

  const type = template.templateType;

  if (type === "POST" && template.post) {
    const post = template.post as {
      content?: string | null;
      caption?: string | null;
      fileUrl?: string[] | string;
      queueType?: { name: string } | null;
      queueTypeId?: string | null;
      tags?: string[] | null;
      hashTagPresetId?: string | null;
      draftMeta?: {
        attachmentMeta?: Array<{ localId: string; url: string; alt?: string }>;
      } | null;
    };
    const fileUrl = Array.isArray(post.fileUrl)
      ? post.fileUrl
      : typeof post.fileUrl === "string"
        ? [post.fileUrl]
        : [];
    return {
      type: "POST" as const,
      post: {
        content: post.content ?? "",
        caption: post.caption ?? "",
        fileUrl,
        queueType: post.queueType?.name ?? "unassigned",
        queueTypeId: post.queueTypeId ?? null,
        tags: Array.isArray(post.tags) ? post.tags.join(" ") : "",
        hashTagPresetId: post.hashTagPresetId ?? null,
        draftMeta: post.draftMeta ?? null,
      },
    };
  }

  if (type === "LONGFORM" && template.longFormPost) {
    const lf = template.longFormPost as {
      title?: string | null;
      summary?: string | null;
      content?: string | null;
      image?: string | null;
      tags?: string[] | null;
      queueType?: { name: string } | null;
    };
    return {
      type: "LONGFORM" as const,
      longform: {
        title: lf.title ?? "",
        summary: lf.summary ?? "",
        content: lf.content ?? "",
        image: lf.image ?? "",
        tags: Array.isArray(lf.tags) ? lf.tags : [],
        queueType: lf.queueType
          ? { name: lf.queueType.name }
          : { name: "unassigned" },
      },
    };
  }

  return null;
}
