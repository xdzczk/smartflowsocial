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

// Script logger (avoids console.*)

const { log, error: logError } = require("./logger") as {
  log: (..._args: unknown[]) => void;
  error: (..._args: unknown[]) => void;
};

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
  log("Backfilling scheduled posts read model...");

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

  log(`Found ${scheduledPosts.length} scheduled posts to backfill`);

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
          queueTypeColorToken: post.queueType?.colorToken ?? null,
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
          queueTypeColorToken: post.queueType?.colorToken ?? null,
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
      logError(`Error backfilling post ${post.id}:`, error);
    }
  }

  log(
    `Scheduled posts backfill complete: ${created} created, ${updated} updated, ${errors} errors`
  );
}

async function backfillPublishedPosts() {
  log("Backfilling published posts read model...");

  // Get all published posts
  const publishedPosts = await prisma.post.findMany({
    where: {
      currentState: "PUBLISHED",
      publishedAt: { not: null },
    },
    include: {
      queueType: true,
    },
  });

  log(`Found ${publishedPosts.length} published posts to backfill`);

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const post of publishedPosts) {
    try {
      if (!post.publishedAt) continue;

      await prisma.publishedPostRead.upsert({
        where: { postId: post.id },
        create: {
          id: post.id,
          userId: post.userId,
          postId: post.id,
          caption: post.caption,
          publishedAt: post.publishedAt,
          queueTypeName: post.queueType?.name ?? "unassigned",
          queueTypeColor: post.queueType?.color ?? null,
          queueTypeColorToken: post.queueType?.colorToken ?? null,
          createdAt: post.createdAt,
          updatedAt: post.updatedAt,
        },
        update: {
          caption: post.caption,
          publishedAt: post.publishedAt,
          queueTypeName: post.queueType?.name ?? "unassigned",
          queueTypeColor: post.queueType?.color ?? null,
          queueTypeColorToken: post.queueType?.colorToken ?? null,
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
      logError(`Error backfilling post ${post.id}:`, error);
    }
  }

  log(
    `Published posts backfill complete: ${created} created, ${updated} updated, ${errors} errors`
  );
}

async function main() {
  log("Starting read models backfill...");
  log("=".repeat(50));

  try {
    await backfillScheduledPosts();
    log("");
    await backfillPublishedPosts();
    log("");
    log("=".repeat(50));
    log("Read models backfill complete!");
  } catch (error) {
    logError("Error during backfill:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
