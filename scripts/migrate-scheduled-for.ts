/**
 * Data Migration Script: scheduledFor String → scheduledAtUtc DateTime
 *
 * Migrates existing scheduledFor string values to scheduledAtUtc DateTime.
 * Run this after deploying the schema changes.
 *
 * Usage: npx tsx scripts/migrate-scheduled-for.ts
 */

import { resolve } from "node:path";
import { config } from "dotenv";
import { Pool } from "pg";

// Script logger (avoids console.*)

const { log, error } = require("./logger") as {
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

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

async function migrateScheduledFor() {
  log("Starting migration of scheduledFor to scheduledAtUtc...");

  const client = await pool.connect();
  try {
    // Verify columns exist (script is safe to run multiple times).
    const { rows: postCols } = await client.query<{
      column_name: string;
    }>(
      `select column_name
       from information_schema.columns
       where table_schema = 'public' and table_name = 'Post'`
    );
    const postColSet = new Set(postCols.map((r) => r.column_name));
    if (!postColSet.has("scheduledFor")) {
      log(
        "Post.scheduledFor column not found (already removed). Nothing to migrate."
      );
      return;
    }
    if (!postColSet.has("scheduledAtUtc")) {
      throw new Error(
        "Post.scheduledAtUtc column not found. Deploy schema changes before running migration."
      );
    }

    const { rows: longCols } = await client.query<{
      column_name: string;
    }>(
      `select column_name
       from information_schema.columns
       where table_schema = 'public' and table_name = 'LongFormPost'`
    );
    const longColSet = new Set(longCols.map((r) => r.column_name));
    if (!longColSet.has("scheduledFor")) {
      log(
        "LongFormPost.scheduledFor column not found (already removed). Nothing to migrate."
      );
    }
    if (!longColSet.has("scheduledAtUtc")) {
      throw new Error(
        "LongFormPost.scheduledAtUtc column not found. Deploy schema changes before running migration."
      );
    }

    // Posts: migrate numeric unix seconds in scheduledFor -> scheduledAtUtc
    log("Migrating Posts...");
    const postResult = await client.query(
      `update "Post"
       set "scheduledAtUtc" = to_timestamp(("scheduledFor")::bigint)::timestamp
       where "scheduledAtUtc" is null
         and "scheduledFor" is not null
         and "scheduledFor" ~ '^[0-9]+$'`
    );
    log(`Posts migrated: ${postResult.rowCount ?? 0}`);

    // LongFormPosts
    log("Migrating LongFormPosts...");
    const longResult = await client.query(
      `update "LongFormPost"
       set "scheduledAtUtc" = to_timestamp(("scheduledFor")::bigint)::timestamp
       where "scheduledAtUtc" is null
         and "scheduledFor" is not null
         and "scheduledFor" ~ '^[0-9]+$'`
    );
    log(`LongFormPosts migrated: ${longResult.rowCount ?? 0}`);

    // Report rows that still have scheduledFor but no scheduledAtUtc (non-numeric legacy values)
    const remainingPosts = await client.query(
      `select count(*)::int as count
       from "Post"
       where "scheduledAtUtc" is null and "scheduledFor" is not null`
    );
    const remainingLong = await client.query(
      `select count(*)::int as count
       from "LongFormPost"
       where "scheduledAtUtc" is null and "scheduledFor" is not null`
    );
    log("Remaining (non-numeric) legacy rows:");
    log(`Post: ${remainingPosts.rows[0]?.count ?? 0}`);
    log(`LongFormPost: ${remainingLong.rows[0]?.count ?? 0}`);
  } finally {
    client.release();
  }
}

migrateScheduledFor()
  .catch((err) => {
    error("Migration failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
