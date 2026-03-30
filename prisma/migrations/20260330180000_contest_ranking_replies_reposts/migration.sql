-- Contest ranking: Most replies / Most reposts; snapshot columns for entries
ALTER TYPE "ContestRankingMetric" ADD VALUE 'REPLIES';
ALTER TYPE "ContestRankingMetric" ADD VALUE 'REPOSTS';

ALTER TABLE "ContestEntry" ADD COLUMN "repliesCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ContestEntry" ADD COLUMN "repostsCount" INTEGER NOT NULL DEFAULT 0;
