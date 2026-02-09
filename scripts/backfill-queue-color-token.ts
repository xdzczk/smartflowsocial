/**
 * Backfill Queue Color Token
 *
 * 1. Sets QueueType.colorToken from existing QueueType.color (nearest token by hue; grayscale → slate).
 * 2. Sets ScheduledPostRead.queueTypeColorToken and PublishedPostRead.queueTypeColorToken from QueueType.
 *
 * Run after applying migration 20260209120000_add_queue_color_token.
 *
 * Usage:
 *   npx tsx scripts/backfill-queue-color-token.ts
 */

import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { Pool } from "pg";

import { hexToNearestQueueColorToken } from "../app/features/posts/queue-colors";

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

async function backfillQueueTypeColorTokens() {
  log("Backfilling QueueType.colorToken from QueueType.color...");

  const queueTypes = await prisma.queueType.findMany({
    select: { id: true, userId: true, name: true, color: true },
  });

  let updated = 0;
  for (const qt of queueTypes) {
    const token = qt.color
      ? hexToNearestQueueColorToken(qt.color)
      : ("slate" as const);
    await prisma.queueType.update({
      where: { id: qt.id },
      data: { colorToken: token },
    });
    updated++;
  }

  log(`Updated ${updated} QueueType rows with colorToken.`);
}

async function backfillReadModelColorTokens() {
  log("Backfilling read models with queueTypeColorToken...");

  const queueTypes = await prisma.queueType.findMany({
    select: { userId: true, name: true, colorToken: true },
  });
  const tokenByUserAndName = new Map<string, string | null>();
  for (const qt of queueTypes) {
    tokenByUserAndName.set(`${qt.userId}:${qt.name}`, qt.colorToken);
  }

  const scheduled = await prisma.scheduledPostRead.findMany({
    select: { postId: true, userId: true, queueTypeName: true },
  });
  let scheduledUpdated = 0;
  for (const row of scheduled) {
    const token =
      tokenByUserAndName.get(`${row.userId}:${row.queueTypeName}`) ?? null;
    await prisma.scheduledPostRead.update({
      where: { postId: row.postId },
      data: { queueTypeColorToken: token },
    });
    scheduledUpdated++;
  }
  log(
    `Updated ${scheduledUpdated} ScheduledPostRead rows with queueTypeColorToken.`
  );

  const published = await prisma.publishedPostRead.findMany({
    select: { postId: true, userId: true, queueTypeName: true },
  });
  let publishedUpdated = 0;
  for (const row of published) {
    const token =
      tokenByUserAndName.get(`${row.userId}:${row.queueTypeName}`) ?? null;
    await prisma.publishedPostRead.update({
      where: { postId: row.postId },
      data: { queueTypeColorToken: token },
    });
    publishedUpdated++;
  }
  log(
    `Updated ${publishedUpdated} PublishedPostRead rows with queueTypeColorToken.`
  );
}

async function main() {
  log("Starting queue color token backfill...");
  log("=".repeat(50));

  try {
    await backfillQueueTypeColorTokens();
    log("");
    await backfillReadModelColorTokens();
    log("");
    log("=".repeat(50));
    log("Queue color token backfill complete!");
  } catch (err) {
    logError("Error during backfill:", err);
    process.exit(1);
  } finally {
    await pool.end();
    await prisma.$disconnect();
  }
}

main();
