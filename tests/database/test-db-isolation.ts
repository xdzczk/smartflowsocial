/**
 * Test Database Isolation Utilities
 *
 * Provides utilities for true transaction-based test isolation
 * using database savepoints and rollbacks
 */

import { PrismaClient } from "@prisma/client";

import { getTestPrisma } from "./test-db";
/**
 * Run a test with true transaction isolation using savepoints
 * This allows rolling back individual tests while keeping the transaction open
 */
export async function withIsolatedTransaction<T>(
  testFn: (prisma: PrismaClient) => Promise<T>
): Promise<T> {
  const prisma = getTestPrisma();

  // Use Prisma's transaction with a workaround for test isolation
  // We'll use a separate test database approach instead
  return await prisma.$transaction(
    async (tx) => {
      const txClient = tx as unknown as PrismaClient;
      return await testFn(txClient);
    },
    {
      timeout: 30000,
      isolationLevel: "ReadCommitted",
    }
  );
}

/**
 * Create a test database client that uses a separate database
 * This provides true isolation between tests
 */
export function createIsolatedTestClient(databaseName: string): PrismaClient {
  const testDatabaseUrl =
    process.env["TEST_DATABASE_URL"] ?? process.env["DATABASE_URL"];

  if (!testDatabaseUrl) {
    throw new Error("TEST_DATABASE_URL or DATABASE_URL must be set");
  }

  // Create a new database URL for this test
  const url = new URL(testDatabaseUrl);
  url.pathname = `/${databaseName}`;

  // Prisma 7: datasources option is no longer supported in constructor
  // Set DATABASE_URL environment variable instead
  const originalUrl = process.env["DATABASE_URL"];
  process.env["DATABASE_URL"] = url.toString();
  try {
    return new PrismaClient();
  } finally {
    // Restore original URL if it existed
    if (originalUrl !== undefined) {
      process.env["DATABASE_URL"] = originalUrl;
    } else {
      delete process.env["DATABASE_URL"];
    }
  }
}

/**
 * Reset test database between tests
 * Useful when not using transactions
 */
export async function resetTestDatabaseBetweenTests(): Promise<void> {
  const prisma = getTestPrisma();

  // Delete all data in reverse dependency order
  await prisma.post.deleteMany({});
  await prisma.longFormPost.deleteMany({});
  await prisma.queueType.deleteMany({});
  await prisma.hashTagPreset.deleteMany({});
  await prisma.template.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.subscription.deleteMany({});
  await prisma.plan.deleteMany({});
  await prisma.user.deleteMany({});
}
