/**
 * Database Test Helpers
 * 
 * Utilities for writing database-integrated tests
 */

import { describe, it, beforeEach, afterEach, beforeAll, afterAll } from "vitest";

import { createMinimalFixtures, createCompleteFixtures } from "./fixtures";
import type { TestFixtures } from "./fixtures";
import type { getTestPrisma } from "./test-db";
import {
  setupTestDatabase,
  teardownTestDatabase,
  useTestDatabase,
  resetTestDatabase,
} from "./test-db";

/**
 * Setup database before all tests
 */
export async function setupDatabaseTests(): Promise<void> {
  await setupTestDatabase();
}

/**
 * Teardown database after all tests
 */
export async function teardownDatabaseTests(): Promise<void> {
  await teardownTestDatabase();
}

/**
 * Create a test suite with database support
 * 
 * @example
 * ```typescript
 * describeDatabase("User Model", () => {
 *   it("should create a user", async () => {
 *     await useTestDatabase(async (prisma) => {
 *       const user = await prisma.user.create({
 *         data: { npub: "npub123", isEnabled: true },
 *       });
 *       expect(user).toBeDefined();
 *     });
 *   });
 * });
 * ```
 */
export function describeDatabase(
  name: string,
  fn: () => void,
  options?: {
    setup?: () => Promise<void>;
    teardown?: () => Promise<void>;
  },
): void {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  const shouldSkip = !testDatabaseUrl || process.env.SKIP_DATABASE_TESTS === "true";

  // Skip the entire suite if database is not configured
  // This prevents beforeAll from failing and marking the suite as failed
  if (shouldSkip) {
    describe.skip(name, fn);
    return;
  }

  describe(name, () => {
    beforeAll(async () => {
      try {
        await setupDatabaseTests();
        if (options?.setup) {
          await options.setup();
        }
      } catch (error) {
        console.warn(
          `Database setup failed for "${name}". Tests will be skipped.`,
          error,
        );
        // Skip all tests in this suite if setup fails
        throw error;
      }
    });

    afterAll(async () => {
      try {
        if (options?.teardown) {
          await options.teardown();
        }
        await teardownDatabaseTests();
      } catch (error) {
        console.warn("Database teardown failed:", error);
      }
    });

    fn();
  });
}

/**
 * Helper to run a test with database access
 * Uses a separate test database for isolation
 * 
 * Note: For true isolation, use a separate TEST_DATABASE_URL.
 * This ensures tests don't interfere with each other.
 */
export async function withDatabase<T>(
  testFn: (prisma: Awaited<ReturnType<typeof getTestPrisma>>) => Promise<T>,
  fixtures?: TestFixtures,
): Promise<T> {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return await useTestDatabase(testFn, {
    useTransaction: false, // Use separate test database instead
    fixtures,
    cleanup: false, // Cleanup handled by separate database
  });
}

/**
 * Helper to run a test with database access without transactions
 * Useful for testing transaction behavior itself
 * WARNING: Requires manual cleanup
 */
export async function withDatabaseNoTransaction<T>(
  testFn: (prisma: Awaited<ReturnType<typeof getTestPrisma>>) => Promise<T>,
  fixtures?: TestFixtures,
): Promise<T> {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return await useTestDatabase(testFn, {
    useTransaction: false,
    fixtures,
  });
}

/**
 * Create test data using factories
 */
export { createMinimalFixtures, createCompleteFixtures, fixtures } from "./fixtures";

