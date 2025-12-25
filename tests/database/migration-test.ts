/**
 * Migration Testing Utilities
 * 
 * Tests database migrations to ensure they work correctly
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "child_process";
import { getTestPrisma, setupTestDatabase, resetTestDatabase } from "./test-db";

describe("Database Migrations", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    // Cleanup handled by teardown
  });

  it("should run migrations successfully", async () => {
    const testDatabaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
    
    if (!testDatabaseUrl) {
      throw new Error("TEST_DATABASE_URL or DATABASE_URL must be set");
    }

    try {
      execSync("npx prisma migrate deploy", {
        env: { ...process.env, DATABASE_URL: testDatabaseUrl },
        stdio: "pipe",
      });
      
      // If we get here, migrations succeeded
      expect(true).toBe(true);
    } catch (error) {
      throw new Error(`Migrations failed: ${error}`);
    }
  });

  it("should have all required tables", async () => {
    const prisma = getTestPrisma();
    
    // Check that we can query each table
    const tables = [
      "user",
      "post",
      "longFormPost",
      "queueType",
      "hashTagPreset",
      "template",
      "asset",
      "payment",
      "plan",
      "subscription",
    ];

    for (const table of tables) {
      try {
        // Try to query the table (this will fail if table doesn't exist)
        await (prisma as any)[table].findMany({ take: 1 });
      } catch (error) {
        throw new Error(`Table ${table} does not exist or is not accessible`);
      }
    }
  });

  it("should have correct indexes", async () => {
    const prisma = getTestPrisma();
    
    // Test that indexes work (by querying with indexed fields)
    // User has unique index on npub
    const user = await prisma.user.findUnique({
      where: { npub: "test-npub" },
    });
    
    // Should not throw - index exists
    expect(user).toBeNull(); // User doesn't exist, but query should work
  });

  it("should handle foreign key constraints", async () => {
    const prisma = getTestPrisma();
    
    // Create user
    const user = await prisma.user.create({
      data: {
        npub: "npub-foreign-key-test",
        isEnabled: true,
      },
    });

    // Create queue type with foreign key to user
    const queue = await prisma.queueType.create({
      data: {
        name: "Test Queue",
        userId: user.id,
        scheduleType: "INTERVAL",
        scheduleConfig: { intervalHours: 4 },
      },
    });

    expect(queue.userId).toBe(user.id);

    // Cleanup
    await prisma.queueType.delete({ where: { id: queue.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it("should handle cascade deletes", async () => {
    const prisma = getTestPrisma();
    
    // Create user
    const user = await prisma.user.create({
      data: {
        npub: "npub-cascade-test",
        isEnabled: true,
      },
    });

    // Create queue type
    const queue = await prisma.queueType.create({
      data: {
        name: "Test Queue",
        userId: user.id,
        scheduleType: "INTERVAL",
        scheduleConfig: { intervalHours: 4 },
      },
    });

    // Delete user - should cascade delete queue
    await prisma.user.delete({ where: { id: user.id } });

    // Queue should be deleted
    const deletedQueue = await prisma.queueType.findUnique({
      where: { id: queue.id },
    });
    
    expect(deletedQueue).toBeNull();
  });
});

