-- Rename postedAt to publishedAt on Post (align with "Published" terminology)
ALTER TABLE "Post" RENAME COLUMN "postedAt" TO "publishedAt";

-- Rename postedAt to publishedAt on PublishedPostRead (read model for published posts)
ALTER TABLE "PublishedPostRead" RENAME COLUMN "postedAt" TO "publishedAt";
