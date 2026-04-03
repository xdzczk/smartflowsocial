/**
 * Example Database Integration Test
 *
 * This file demonstrates how to write tests that use a real database
 * with transaction-based isolation for safety.
 *
 * **Requirements:**
 * - Set `RUN_DATABASE_EXAMPLES=true` and `TEST_DATABASE_URL` or `DATABASE_URL` to a working DB
 * - Or set `SKIP_DATABASE_TESTS=true` (suite still skipped without the run flag)
 * - Database must exist and be migrated (e.g. `smartflow_test` if that is your URL)
 *
 * **Note:** This file is opt-in only (`RUN_DATABASE_EXAMPLES=true`) so default `vitest run`
 * does not fail when no local test database is provisioned.
 */
import type { PrismaClient } from "@prisma/client";
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  vi,
  beforeEach,
} from "vitest";

import {
  describeDatabase,
  withDatabase,
  createMinimalFixtures,
  fixtures,
} from "../database/database-test-helpers";
import { getTestPrisma } from "../database/test-db";

import { createPost } from "~/features/posts/server";
import { getUserById } from "~/features/user";

// Opt-in example suite: avoids failures when env has a URL but the DB was never created.
const testDatabaseUrl =
  process.env["TEST_DATABASE_URL"] ?? process.env["DATABASE_URL"];
const shouldSkipDatabaseExamples =
  process.env["SKIP_DATABASE_TESTS"] === "true" ||
  !testDatabaseUrl ||
  process.env["RUN_DATABASE_EXAMPLES"] !== "true";
const RUN_DATABASE_EXAMPLES = !shouldSkipDatabaseExamples;

// Don't mock Prisma - this test uses the real database
// Model functions will use the real Prisma client from getTestPrisma()
// We need to ensure prisma.server.ts uses getTestPrisma() in test mode
// For now, we'll mock it minimally to prevent $use errors, but the actual
// database operations will use the real client from withDatabase
if (RUN_DATABASE_EXAMPLES) {
  vi.mock("~/lib/prisma.server", async () => {
    // Return a proxy that forwards to getTestPrisma() when accessed
    // Handle case where database URL is not set (tests will be skipped)
    const { getTestPrisma } = await import("../database/test-db");
    return {
      get prisma() {
        try {
          return getTestPrisma();
        } catch (_error) {
          // If database URL is not set, return a mock Prisma client
          // The describeDatabase helper will skip the tests anyway
          return {
            $use: vi.fn(),
            $transaction: vi.fn(),
            user: { findUnique: vi.fn(), create: vi.fn() },
            post: { findUnique: vi.fn(), create: vi.fn() },
          } as unknown as PrismaClient;
        }
      },
    };
  });
}

// Example: Test with database using transactions (runs when DB is configured)
const describeDb = RUN_DATABASE_EXAMPLES ? describeDatabase : describe.skip;

describeDb("Database Integration Example", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create and retrieve a user", async () => {
    await withDatabase(async (prisma) => {
      // Create user
      const user = await prisma.user.create({
        data: {
          npub: "npub-test-123",
          isEnabled: true,
        },
      });

      expect(user).toBeDefined();
      expect(user.npub).toBe("npub-test-123");

      // Retrieve user
      const retrieved = await prisma.user.findUnique({
        where: { id: user.id },
      });

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(user.id);
    });
    // Transaction is automatically rolled back - no cleanup needed!
  });

  it("should create user with fixtures", async () => {
    const testFixtures = createMinimalFixtures();

    await withDatabase(async (prisma) => {
      // Fixtures are automatically applied
      const firstUser = testFixtures.users?.[0];
      if (!firstUser?.id) {
        throw new Error("Test fixture user not found");
      }
      const user = await prisma.user.findFirst({
        where: { id: firstUser.id },
      });

      expect(user).toBeDefined();
    }, testFixtures);
  });

  it("should test model functions with real database", async () => {
    await withDatabase(async (prisma) => {
      // Create user first
      const user = await prisma.user.create({
        data: {
          npub: "npub-test-456",
          isEnabled: true,
        },
      });

      // Test model function
      const retrieved = await getUserById(user.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(user.id);
    });
  });

  it("should test relationships", async () => {
    const testFixtures = fixtures.userWithQueues();

    await withDatabase(async (prisma) => {
      const firstUser = testFixtures.users?.[0];
      if (!firstUser?.id) {
        throw new Error("Test fixture user not found");
      }
      const user = await prisma.user.findUnique({
        where: { id: firstUser.id },
        include: {
          queueTypes: true,
        },
      });

      expect(user).toBeDefined();
      expect(user?.queueTypes).toHaveLength(2);
    }, testFixtures);
  });

  it("should test post creation with queue", async () => {
    const testFixtures = fixtures.userWithQueues();

    await withDatabase(async (_prisma) => {
      const user = testFixtures.users?.[0];
      const queue = testFixtures.queueTypes?.[0];
      if (!user?.id || !queue?.id) {
        throw new Error("Test fixtures not found");
      }

      // Create post using model function
      const post = await createPost({
        userId: user.id,
        content: "Test post",
        queueTypeId: queue.id,
        fileUrl: [],
        tags: [],
        postType: "TEXT",
      });

      expect(post).toBeDefined();
      expect(post.userId).toBe(user.id);
      expect(post.queueTypeId).toBe(queue.id);
    }, testFixtures);
  });
});

// Example: Test without transactions (same opt-in as main example block)
if (!RUN_DATABASE_EXAMPLES) {
  describe.skip("Database Tests Without Transactions", () => {
    it("should persist data without transactions", () => {
      // Skipped - database example suite not enabled
    });
  });
} else {
  describe("Database Tests Without Transactions", () => {
    beforeAll(async () => {
      // Setup database
    });

    afterAll(async () => {
      // Cleanup - reset database
      const prisma = getTestPrisma();
      await prisma.user.deleteMany({});
    });

    it("should persist data without transactions", async () => {
      const prisma = getTestPrisma();

      const user = await prisma.user.create({
        data: {
          npub: "npub-persist-test",
          isEnabled: true,
        },
      });

      // Data persists - requires manual cleanup
      expect(user).toBeDefined();

      // Cleanup
      await prisma.user.delete({ where: { id: user.id } });
    });
  });
}
