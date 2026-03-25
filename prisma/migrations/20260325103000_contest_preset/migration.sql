-- CreateTable
CREATE TABLE "public"."ContestPreset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "rankingMetric" "public"."ContestRankingMetric" NOT NULL,
    "prizeMode" "public"."ContestPrizeMode" NOT NULL,
    "winnerCount" INTEGER NOT NULL,
    "equalRewardSats" INTEGER,
    "rankRewards" JSONB,
    "fairnessConfig" JSONB,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContestPreset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContestPreset_userId_name_key" ON "public"."ContestPreset"("userId", "name");

-- AddForeignKey
ALTER TABLE "public"."ContestPreset" ADD CONSTRAINT "ContestPreset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
