/**
 * Example Database Integration Test
 * 
 * This file demonstrates how to write tests that use a real database
 * with transaction-based isolation for safety
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  describeDatabase,
  withDatabase,
  createMinimalFixtures,
  fixtures,
} from "../database/database-test-helpers";
import { getTestPrisma } from "../database/test-db";
import { getUserById } from "~/models/user.server";
import { createPost } from "~/models/post.server";

// Example: Test with database using transactions
describeDatabase("Database Integration Example", () => {
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
      const user = await prisma.user.findFirst({
        where: { id: testFixtures.users![0].id },
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
      const user = await prisma.user.findUnique({
        where: { id: testFixtures.users![0].id },
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
    
    await withDatabase(async (prisma) => {
      const user = testFixtures.users![0];
      const queue = testFixtures.queueTypes![0];

      // Create post using model function
      const post = await createPost({
        userId: user.id!,
        content: "Test post",
        queueTypeId: queue.id!,
      });

      expect(post).toBeDefined();
      expect(post.userId).toBe(user.id);
      expect(post.queueTypeId).toBe(queue.id);
    }, testFixtures);
  });
});

// Example: Test without transactions (for testing transaction behavior)
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


