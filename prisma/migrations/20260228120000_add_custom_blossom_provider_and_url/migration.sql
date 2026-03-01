-- AlterEnum
ALTER TYPE "public"."UploadProvider" ADD VALUE 'BLOSSOM_CUSTOM';

-- AlterTable
ALTER TABLE "public"."User"
ADD COLUMN "customBlossomUrl" TEXT;
