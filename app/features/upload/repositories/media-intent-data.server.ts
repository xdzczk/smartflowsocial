import { prisma } from "~/lib/prisma.server";

type UploadProviderName =
  | "S3"
  | "BLOSSOM_PRIMAL"
  | "BLOSSOM_BLOSSTR"
  | "BLOSSOM_SFS"
  | "BLOSSOM_CUSTOM";

export async function createMediaUploadIntent(params: {
  intentId: string;
  userId: string;
  provider: UploadProviderName;
  fileCount: number;
  composeSessionId?: string | null;
  expiresAt: Date;
}) {
  return prisma.mediaUploadIntent.create({
    data: {
      intentId: params.intentId,
      userId: params.userId,
      provider: params.provider,
      fileCount: params.fileCount,
      composeSessionId: params.composeSessionId ?? null,
      expiresAt: params.expiresAt,
    },
  });
}

export async function findMediaUploadIntentByIntentId(intentId: string) {
  return prisma.mediaUploadIntent.findUnique({
    where: { intentId },
  });
}
