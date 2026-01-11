// Use this to delete a Nostr user by their npub
// Simply call this with:
// npx tsx ./tests/e2e/support/delete-nostr-user.ts npub1xxx

// Load environment variables FIRST using require to ensure it runs before any imports
require("./load-env.js");

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "@prisma/client";
import { installGlobals } from "@remix-run/node";
import { Pool } from "pg";
installGlobals();

async function deleteNostrUser(npub: string) {
  if (!npub) {
    throw new Error("npub required");
  }

  // Verify DATABASE_URL is set
  const dbUrl = process.env["DATABASE_URL"];
  if (!dbUrl || dbUrl.trim() === "") {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  // Create Prisma client using adapter pattern
  const pool = new Pool({
    connectionString: dbUrl,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({
    adapter: adapter,
  });

  try {
    await prisma.user.delete({ where: { npub } });

    console.log("User deleted successfully");
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        console.log("User not found, so no need to delete");
        return;
      }
    }
    throw error;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

async function main() {
  try {
    const npub = process.argv[2];
    if (!npub) {
      console.error("Error: npub required");
      process.exit(1);
    }
    await deleteNostrUser(npub);
    process.exit(0);
  } catch (error) {
    console.error(
      "Error deleting user:",
      error instanceof Error ? error.message : String(error)
    );
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

void main();
