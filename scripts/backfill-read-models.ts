/**
 * Backfill Read Models Script
 *
 * Populates read models from existing transactional data.
 * Run this once after deploying read model tables.
 *
 * Usage:
 *   npx tsx scripts/backfill-read-models.ts
 */

import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { Pool } from "pg";

// Load environment variables
config({ path: resolve(process.cwd(), ".env") });

// Get DATABASE_URL from environment
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

// Create Prisma client with adapter (required for Prisma 7)
const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function backfillScheduledPosts() {
  console.log("Backfilling scheduled posts read model...");

  // Get all scheduled posts
  const scheduledPosts = await prisma.post.findMany({
    where: {
      isScheduled: true,
      isPosted: false,
      scheduledAtUtc: { not: null },
    },
    include: {
      queueType: true,
    },
  });

  console.log(`Found ${scheduledPosts.length} scheduled posts to backfill`);

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const post of scheduledPosts) {
    try {
      if (!post.scheduledAtUtc) continue;

      await prisma.scheduledPostRead.upsert({
        where: { postId: post.id },
        create: {
          id: post.id,
          userId: post.userId,
          postId: post.id,
          caption: post.caption,
          scheduledAtUtc: post.scheduledAtUtc,
          queueTypeName: post.queueType?.name ?? "unassigned",
          queueTypeColor: post.queueType?.color ?? null,
          hashTagPresetId: post.hashTagPresetId,
          templateId: post.templateId,
          createdAt: post.createdAt,
          updatedAt: post.updatedAt,
        },
        update: {
          caption: post.caption,
          scheduledAtUtc: post.scheduledAtUtc,
          queueTypeName: post.queueType?.name ?? "unassigned",
          queueTypeColor: post.queueType?.color ?? null,
          hashTagPresetId: post.hashTagPresetId,
          templateId: post.templateId,
          updatedAt: new Date(),
        },
      });

      // Check if it was created or updated
      const existing = await prisma.scheduledPostRead.findUnique({
        where: { postId: post.id },
      });
      if (
        existing &&
        existing.createdAt.getTime() === post.createdAt.getTime()
      ) {
        created++;
      } else {
        updated++;
      }
    } catch (error) {
      errors++;
      console.error(`Error backfilling post ${post.id}:`, error);
    }
  }

  console.log(
    `Scheduled posts backfill complete: ${created} created, ${updated} updated, ${errors} errors`
  );
}

async function backfillPublishedPosts() {
  console.log("Backfilling published posts read model...");

  // Get all published posts
  const publishedPosts = await prisma.post.findMany({
    where: {
      isPosted: true,
      postedAt: { not: null },
    },
    include: {
      queueType: true,
    },
  });

  console.log(`Found ${publishedPosts.length} published posts to backfill`);

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const post of publishedPosts) {
    try {
      if (!post.postedAt) continue;

      await prisma.publishedPostRead.upsert({
        where: { postId: post.id },
        create: {
          id: post.id,
          userId: post.userId,
          postId: post.id,
          caption: post.caption,
          postedAt: post.postedAt,
          queueTypeName: post.queueType?.name ?? "unassigned",
          queueTypeColor: post.queueType?.color ?? null,
          createdAt: post.createdAt,
          updatedAt: post.updatedAt,
        },
        update: {
          caption: post.caption,
          postedAt: post.postedAt,
          queueTypeName: post.queueType?.name ?? "unassigned",
          queueTypeColor: post.queueType?.color ?? null,
          updatedAt: new Date(),
        },
      });

      // Check if it was created or updated
      const existing = await prisma.publishedPostRead.findUnique({
        where: { postId: post.id },
      });
      if (
        existing &&
        existing.createdAt.getTime() === post.createdAt.getTime()
      ) {
        created++;
      } else {
        updated++;
      }
    } catch (error) {
      errors++;
      console.error(`Error backfilling post ${post.id}:`, error);
    }
  }

  console.log(
    `Published posts backfill complete: ${created} created, ${updated} updated, ${errors} errors`
  );
}

async function main() {
  console.log("Starting read models backfill...");
  console.log("=".repeat(50));

  try {
    await backfillScheduledPosts();
    console.log("");
    await backfillPublishedPosts();
    console.log("");
    console.log("=".repeat(50));
    console.log("Read models backfill complete!");
  } catch (error) {
    console.error("Error during backfill:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
