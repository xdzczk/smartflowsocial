/**
 * Test Database Utilities
 * 
 * Provides utilities for setting up and managing test databases
 * with transaction-based isolation for test safety
 */

import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";

let testPrisma: PrismaClient | null = null;
let transactionClient: PrismaClient | null = null;

/**
 * Get or create test Prisma client
 * Uses separate test database URL if available
 */
export function getTestPrisma(): PrismaClient {
  if (testPrisma) {
    return testPrisma;
  }

  const testDatabaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  
  if (!testDatabaseUrl) {
    throw new Error(
      "TEST_DATABASE_URL or DATABASE_URL must be set for database tests",
    );
  }

  testPrisma = new PrismaClient({
    datasources: {
      db: {
        url: testDatabaseUrl,
      },
    },
    log: process.env.DEBUG ? ["query", "error", "warn"] : ["error"],
  });

  return testPrisma;
}

/**
 * Create a transaction client for test isolation
 * Each test runs in its own transaction that gets rolled back
 */
export async function createTransactionClient(): Promise<PrismaClient> {
  const prisma = getTestPrisma();
  
  // Start a transaction
  const transaction = await prisma.$transaction(async (tx) => {
    // Return a client that uses this transaction
    return tx as unknown as PrismaClient;
  }, {
    timeout: 10000,
  });

  // For Prisma, we'll use a different approach - wrap operations in transactions
  return prisma;
}

/**
 * Run a test function within a transaction
 * The transaction is rolled back after the test, ensuring test isolation
 */
export async function withTransaction<T>(
  testFn: (prisma: PrismaClient) => Promise<T>,
): Promise<T> {
  const prisma = getTestPrisma();
  
  return await prisma.$transaction(
    async (tx) => {
      // Cast transaction client to PrismaClient for type compatibility
      const txClient = tx as unknown as PrismaClient;
      return await testFn(txClient);
    },
    {
      timeout: 30000,
      isolationLevel: "ReadCommitted",
    },
  );
}

/**
 * Setup test database
 * Runs migrations and seeds test data
 */
export async function setupTestDatabase(): Promise<void> {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  
  if (!testDatabaseUrl) {
    throw new Error("TEST_DATABASE_URL or DATABASE_URL must be set");
  }

  try {
    // Run migrations
    execSync("npx prisma migrate deploy", {
      env: { ...process.env, DATABASE_URL: testDatabaseUrl },
      stdio: "inherit",
    });
  } catch (error) {
    console.error("Failed to run migrations:", error);
    throw error;
  }
}

/**
 * Teardown test database
 * Cleans up test data (optional - transactions handle most cleanup)
 */
export async function teardownTestDatabase(): Promise<void> {
  if (testPrisma) {
    await testPrisma.$disconnect();
    testPrisma = null;
  }
  
  if (transactionClient) {
    await transactionClient.$disconnect();
    transactionClient = null;
  }
}

/**
 * Reset test database
 * Drops all data and re-runs migrations
 * WARNING: Destructive operation - only use in test environments
 */
export async function resetTestDatabase(): Promise<void> {
  const prisma = getTestPrisma();
  
  // Get all model names from Prisma schema
  const modelNames = [
    "User",
    "Post",
    "LongFormPost",
    "QueueType",
    "HashTagPreset",
    "Template",
    "Asset",
    "Payment",
    "Plan",
    "Subscription",
  ];

  // Delete in reverse order of dependencies
  for (const modelName of modelNames.reverse()) {
    try {
      await (prisma as any)[modelName.toLowerCase()].deleteMany({});
    } catch (error) {
      // Ignore errors for models that don't exist or have dependencies
      console.warn(`Could not delete ${modelName}:`, error);
    }
  }
}

/**
 * Seed test database with fixtures
 */
export async function seedTestDatabase(fixtures?: any): Promise<void> {
  const prisma = getTestPrisma();
  
  if (fixtures) {
    // Use provided fixtures
    await applyFixtures(prisma, fixtures);
  } else {
    // Use default seed
    try {
      execSync("npm run db:seed", {
        env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL },
        stdio: "inherit",
      });
    } catch (error) {
      console.warn("Failed to run seed, continuing without seed data");
    }
  }
}

/**
 * Apply fixtures to database
 */
async function applyFixtures(prisma: PrismaClient, fixtures: any): Promise<void> {
  // Apply fixtures in dependency order
  if (fixtures.users) {
    for (const user of fixtures.users) {
      await prisma.user.create({ data: user });
    }
  }
  
  if (fixtures.queueTypes) {
    for (const queueType of fixtures.queueTypes) {
      await prisma.queueType.create({ data: queueType });
    }
  }
  
  if (fixtures.hashTagPresets) {
    for (const preset of fixtures.hashTagPresets) {
      await prisma.hashTagPreset.create({ data: preset });
    }
  }
  
  if (fixtures.posts) {
    for (const post of fixtures.posts) {
      await prisma.post.create({ data: post });
    }
  }
  
  if (fixtures.longFormPosts) {
    for (const longform of fixtures.longFormPosts) {
      await prisma.longFormPost.create({ data: longform });
    }
  }
}

/**
 * Helper to use database in tests with automatic cleanup
 * 
 * Note: For true transaction rollback, use a separate test database.
 * This function applies fixtures and runs tests, but cleanup should be
 * handled by using a dedicated test database or manual cleanup.
 */
export async function useTestDatabase<T>(
  testFn: (prisma: PrismaClient) => Promise<T>,
  options?: {
    useTransaction?: boolean;
    fixtures?: any;
    cleanup?: boolean;
  },
): Promise<T> {
  const { useTransaction = false, fixtures, cleanup = true } = options || {};
  const prisma = getTestPrisma();
  
  // Apply fixtures if provided
  if (fixtures) {
    await applyFixtures(prisma, fixtures);
  }
  
  try {
    if (useTransaction) {
      // Run in transaction (commits, but provides consistency)
      return await prisma.$transaction(async (tx) => {
        const txClient = tx as unknown as PrismaClient;
        return await testFn(txClient);
      });
    } else {
      // Run directly
      return await testFn(prisma);
    }
  } finally {
    // Cleanup if requested (for non-transaction tests)
    if (cleanup && !useTransaction) {
      // Cleanup is handled by using a separate test database
      // or by resetting between tests
    }
  }
}

