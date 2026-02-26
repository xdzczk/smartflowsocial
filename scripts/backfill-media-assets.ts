/**
 * Backfill canonical media assets/variants from legacy Media rows.
 *
 * Usage:
 *   npx tsx scripts/backfill-media-assets.ts
 */

import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { Pool } from "pg";

const { log, error: logError } = require("./logger") as {
  log: (..._args: unknown[]) => void;
  error: (..._args: unknown[]) => void;
};

config({ path: resolve(process.cwd(), ".env") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  log("Starting media asset backfill...");
  const pageSize = 500;
  let cursor: string | undefined;
  let processed = 0;
  let createdAssets = 0;
  let createdVariants = 0;

  while (true) {
    const rows = await prisma.media.findMany({
      take: pageSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
    });
    if (rows.length === 0) break;

    for (const media of rows) {
      try {
        const existingAsset =
          media.sha256 != null
            ? await prisma.mediaAsset.findFirst({
                where: { userId: media.userId, sha256: media.sha256 },
                select: { id: true },
              })
            : null;

        const asset =
          existingAsset ??
          (await prisma.mediaAsset.create({
            data: {
              userId: media.userId,
              sha256: media.sha256 ?? null,
              sourceMimeType: media.mimeType ?? "application/octet-stream",
              sourceBytes: media.size ?? 0,
              sourceProvider: media.provider,
              status: "ready",
              lastProcessedAt: media.createdAt,
            },
          }));
        if (!existingAsset) createdAssets++;

        const existingVariant = await prisma.mediaVariant.findFirst({
          where: {
            assetId: asset.id,
            variantKind: "original",
            provider: media.provider,
            url: media.url,
          },
          select: { id: true },
        });
        if (!existingVariant) {
          await prisma.mediaVariant.create({
            data: {
              assetId: asset.id,
              variantKind: "original",
              mimeType: media.mimeType ?? "application/octet-stream",
              bytes: media.size ?? 0,
              url: media.url,
              provider: media.provider,
              isPrimary: true,
              status: "ready",
              createdAt: media.createdAt,
            },
          });
          createdVariants++;
        }
        processed++;
      } catch (error) {
        logError(`Failed backfill for media id=${media.id}`, error);
      }
    }

    cursor = rows[rows.length - 1]?.id;
    log(`Processed ${processed} media rows so far...`);
  }

  log(
    `Backfill complete. processed=${processed}, assetsCreated=${createdAssets}, variantsCreated=${createdVariants}`
  );
}

main()
  .catch((error) => {
    logError("Backfill failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
