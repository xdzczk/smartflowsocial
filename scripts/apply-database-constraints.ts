/**
 * Apply database constraints
 * 
 * This script applies CHECK constraints to enforce data integrity at the database level.
 * Since Prisma doesn't support CHECK constraints directly, we apply them via raw SQL.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { Pool } from "pg";
import { readFileSync } from "fs";
import { resolve } from "path";

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

async function applyConstraints() {
  try {
    console.log("Applying database constraints...");

    const migrationPath = resolve(
      __dirname,
      "../prisma/migrations/20250102000000_add_database_constraints/migration.sql"
    );
    const sql = readFileSync(migrationPath, "utf-8");

    // Split SQL into individual statements
    // Handle multi-line statements properly by splitting on semicolons that are followed by newline or end of string
    // Remove comments first
    const sqlWithoutComments = sql
      .split("\n")
      .map((line) => {
        const commentIndex = line.indexOf("--");
        return commentIndex >= 0 ? line.substring(0, commentIndex) : line;
      })
      .join("\n");

    // Split on semicolons, but keep multi-line statements together
    const statements = sqlWithoutComments
      .split(/;\s*\n/)
      .map((s) => s.trim().replace(/\n/g, " "))
      .filter((s) => s.length > 0 && s.toUpperCase().startsWith("ALTER"));

    for (const statement of statements) {
      try {
        await prisma.$executeRawUnsafe(statement);
        console.log(`✓ Applied: ${statement.substring(0, 60)}...`);
      } catch (error) {
        // Ignore errors for constraints that already exist or comments on non-existent constraints
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (
          errorMessage.includes("already exists") ||
          errorMessage.includes("duplicate") ||
          errorMessage.includes("does not exist") ||
          errorMessage.includes("42704") // PostgreSQL error code for undefined object
        ) {
          console.log(`⚠ Skipped: ${statement.substring(0, 60)}...`);
        } else {
          console.error(`✗ Failed: ${statement.substring(0, 60)}...`);
          console.error(`  Error: ${errorMessage}`);
        }
      }
    }

    // Verify constraints were created
    console.log("\nVerifying constraints...");
    const constraintCheck = await prisma.$queryRawUnsafe<Array<{ constraint_name: string }>>(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE constraint_type = 'CHECK' 
      AND table_schema = 'public'
      AND constraint_name LIKE '%_check'
      ORDER BY constraint_name;
    `);
    
    console.log(`Found ${constraintCheck.length} CHECK constraints:`);
    for (const constraint of constraintCheck) {
      console.log(`  - ${constraint.constraint_name}`);
    }

    console.log("\n✅ Database constraints applied successfully!");
  } catch (error) {
    console.error("❌ Error applying constraints:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

void applyConstraints();
