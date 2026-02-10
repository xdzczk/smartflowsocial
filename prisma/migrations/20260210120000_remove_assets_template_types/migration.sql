-- Remove Asset model and AssetType enum
DROP TABLE IF EXISTS "public"."Asset";
DROP TYPE IF EXISTS "public"."AssetType";

-- Remove maxAssets from Plan
ALTER TABLE "public"."Plan" DROP COLUMN IF EXISTS "maxAssets";

-- Create TemplateType enum for individual template types
CREATE TYPE "public"."TemplateType" AS ENUM ('POST', 'LONGFORM');

-- Drop Post.templateId (Template 1-n Post relation)
ALTER TABLE "public"."Post" DROP CONSTRAINT IF EXISTS "Post_templateId_fkey";
ALTER TABLE "public"."Post" DROP COLUMN IF EXISTS "templateId";

-- Add Template columns: postId, templateType, longFormPostId
ALTER TABLE "public"."Template" ADD COLUMN "templateType" "public"."TemplateType" NOT NULL DEFAULT 'POST';
ALTER TABLE "public"."Template" ADD COLUMN "postId" TEXT;
ALTER TABLE "public"."Template" ADD COLUMN "longFormPostId" TEXT;

-- Unique constraints for 1-1 relations
CREATE UNIQUE INDEX "Template_postId_key" ON "public"."Template"("postId");
CREATE UNIQUE INDEX "Template_longFormPostId_key" ON "public"."Template"("longFormPostId");

-- Foreign keys
ALTER TABLE "public"."Template" ADD CONSTRAINT "Template_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Template" ADD CONSTRAINT "Template_longFormPostId_fkey" FOREIGN KEY ("longFormPostId") REFERENCES "public"."LongFormPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
