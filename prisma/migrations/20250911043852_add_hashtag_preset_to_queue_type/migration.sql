-- AlterTable
ALTER TABLE "public"."QueueType" ADD COLUMN     "hashTagPresetId" TEXT;

-- AddForeignKey
ALTER TABLE "public"."QueueType" ADD CONSTRAINT "QueueType_hashTagPresetId_fkey" FOREIGN KEY ("hashTagPresetId") REFERENCES "public"."HashTagPreset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
