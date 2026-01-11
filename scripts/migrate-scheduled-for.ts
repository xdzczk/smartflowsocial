/**
 * Data Migration Script: scheduledFor String → scheduledAtUtc DateTime
 *
 * Migrates existing scheduledFor string values to scheduledAtUtc DateTime.
 * Run this after deploying the schema changes.
 *
 * Usage: npx tsx scripts/migrate-scheduled-for.ts
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

async function migrateScheduledFor() {
  console.log("Starting migration of scheduledFor to scheduledAtUtc...");

  // Migrate Posts
  console.log("Migrating Posts...");
  const posts = await prisma.post.findMany({
    where: {
      scheduledFor: { not: null },
      scheduledAtUtc: null, // Only migrate unmigrated
    },
    select: {
      id: true,
      scheduledFor: true,
    },
  });

  console.log(`Found ${posts.length} posts to migrate`);

  let migrated = 0;
  let errors = 0;

  for (const post of posts) {
    if (post.scheduledFor) {
      try {
        const timestamp = parseInt(post.scheduledFor, 10);
        if (!isNaN(timestamp)) {
          const scheduledAtUtc = new Date(timestamp * 1000); // Convert seconds to ms

          await prisma.post.update({
            where: { id: post.id },
            data: { scheduledAtUtc },
          });

          migrated++;
          if (migrated % 100 === 0) {
            console.log(`Migrated ${migrated} posts...`);
          }
        } else {
          console.warn(
            `Invalid timestamp for post ${post.id}: ${post.scheduledFor}`
          );
          errors++;
        }
      } catch (error) {
        console.error(`Error migrating post ${post.id}:`, error);
        errors++;
      }
    }
  }

  console.log(
    `Posts migration complete: ${migrated} migrated, ${errors} errors`
  );

  // Migrate LongFormPosts
  console.log("Migrating LongFormPosts...");
  const longFormPosts = await prisma.longFormPost.findMany({
    where: {
      scheduledFor: { not: null },
      scheduledAtUtc: null,
    },
    select: {
      id: true,
      scheduledFor: true,
    },
  });

  console.log(`Found ${longFormPosts.length} longform posts to migrate`);

  let longFormMigrated = 0;
  let longFormErrors = 0;

  for (const post of longFormPosts) {
    if (post.scheduledFor) {
      try {
        const timestamp = parseInt(post.scheduledFor, 10);
        if (!isNaN(timestamp)) {
          const scheduledAtUtc = new Date(timestamp * 1000);

          await prisma.longFormPost.update({
            where: { id: post.id },
            data: { scheduledAtUtc },
          });

          longFormMigrated++;
          if (longFormMigrated % 100 === 0) {
            console.log(`Migrated ${longFormMigrated} longform posts...`);
          }
        } else {
          console.warn(
            `Invalid timestamp for longform post ${post.id}: ${post.scheduledFor}`
          );
          longFormErrors++;
        }
      } catch (error) {
        console.error(`Error migrating longform post ${post.id}:`, error);
        longFormErrors++;
      }
    }
  }

  console.log(
    `LongFormPosts migration complete: ${longFormMigrated} migrated, ${longFormErrors} errors`
  );

  console.log("\nMigration summary:");
  console.log(`Posts: ${migrated} migrated, ${errors} errors`);
  console.log(
    `LongFormPosts: ${longFormMigrated} migrated, ${longFormErrors} errors`
  );
}

migrateScheduledFor()
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
