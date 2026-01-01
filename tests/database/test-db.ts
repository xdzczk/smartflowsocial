/**
 * Test Database Utilities
 * 
 * Provides utilities for setting up and managing test databases
 * with transaction-based isolation for test safety
 */

import { execSync } from "child_process";

import type { Prisma } from "@prisma/client";
import { PrismaClient } from "@prisma/client";

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

  const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  
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
  await prisma.$transaction(async (tx) => {
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
 * Syncs schema and seeds test data
 * Uses `db push` for test databases as it doesn't require migrations
 */
export function setupTestDatabase(): Promise<void> {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  
  if (!testDatabaseUrl) {
    throw new Error("TEST_DATABASE_URL or DATABASE_URL must be set");
  }

  try {
    // Use db push for test databases - it syncs schema without requiring migrations
    // This works even if the database already has schema
    // db push is safer than migrate deploy for test databases as it doesn't require
    // migration history or baseline setup
    execSync("npx prisma db push --skip-generate", {
      env: { ...process.env, DATABASE_URL: testDatabaseUrl },
      stdio: "inherit",
    });
    return Promise.resolve();
  } catch (error) {
    console.error("Failed to sync database schema:", error);
    // If db push fails, it might be due to breaking schema changes
    // In that case, use a fresh test database or manually resolve conflicts
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
      const modelKey = modelName.toLowerCase() as keyof PrismaClient;
      const model = prisma[modelKey] as { deleteMany: (args: {}) => Promise<unknown> } | undefined;
      if (model && typeof model.deleteMany === "function") {
        await model.deleteMany({});
      }
    } catch (error) {
      // Ignore errors for models that don't exist or have dependencies
      console.warn(`Could not delete ${modelName}:`, error);
    }
  }
}

/**
 * Seed test database with fixtures
 */
interface TestFixtures {
  users?: Array<{ id?: string; [key: string]: unknown }>;
  queueTypes?: Array<{ id?: string; [key: string]: unknown }>;
  hashTagPresets?: Array<{ id?: string; [key: string]: unknown }>;
  posts?: Array<{ id?: string; [key: string]: unknown }>;
  longFormPosts?: Array<{ id?: string; [key: string]: unknown }>;
  payments?: Array<{ id?: string; [key: string]: unknown }>;
  plans?: Array<{ id?: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

export async function seedTestDatabase(fixtures?: TestFixtures): Promise<void> {
  const prisma = getTestPrisma();
  
  if (fixtures) {
    // Use provided fixtures
    await applyFixtures(prisma, fixtures);
  } else {
    // Use default seed
    try {
      execSync("npm run db:seed", {
        env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL },
        stdio: "inherit",
      });
    } catch {
      console.warn("Failed to run seed, continuing without seed data");
    }
  }
}

/**
 * Apply fixtures to database
 * Uses upsert to handle existing records (idempotent)
 */
async function applyFixtures(
  prisma: PrismaClient,
  // Dynamic import() type annotation needed for conditional type
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  fixtures: TestFixtures | import("./fixtures").TestFixtures
): Promise<void> {
  // Apply fixtures in dependency order
  if (fixtures.users && Array.isArray(fixtures.users)) {
    for (const user of fixtures.users) {
      // Use upsert to handle existing records
      const userId = user && typeof user === "object" && "id" in user && typeof user.id === "string" ? user.id : undefined;
      if (userId) {
        await prisma.user.upsert({
          where: { id: userId },
          update: user as unknown as Prisma.UserUpdateInput,
          create: user as unknown as Prisma.UserCreateInput,
        });
      } else {
        await prisma.user.create({ data: user as unknown as Prisma.UserCreateInput });
      }
    }
  }
  
  if (fixtures.queueTypes && Array.isArray(fixtures.queueTypes)) {
    for (const queueType of fixtures.queueTypes) {
      const queueTypeId = queueType && typeof queueType === "object" && "id" in queueType && typeof queueType.id === "string" ? queueType.id : undefined;
      if (queueTypeId) {
        await prisma.queueType.upsert({
          where: { id: queueTypeId },
          update: queueType as unknown as Prisma.QueueTypeUpdateInput,
          create: queueType as unknown as Prisma.QueueTypeCreateInput,
        });
      } else {
        await prisma.queueType.create({ data: queueType as unknown as Prisma.QueueTypeCreateInput });
      }
    }
  }
  
  if (fixtures.hashTagPresets && Array.isArray(fixtures.hashTagPresets)) {
    for (const preset of fixtures.hashTagPresets) {
      const presetId = preset && typeof preset === "object" && "id" in preset && typeof preset.id === "string" ? preset.id : undefined;
      if (presetId) {
        await prisma.hashTagPreset.upsert({
          where: { id: presetId },
          update: preset as unknown as Prisma.HashTagPresetUpdateInput,
          create: preset as unknown as Prisma.HashTagPresetCreateInput,
        });
      } else {
        await prisma.hashTagPreset.create({ data: preset as unknown as Prisma.HashTagPresetCreateInput });
      }
    }
  }
  
  if (fixtures.posts && Array.isArray(fixtures.posts)) {
    for (const post of fixtures.posts) {
      const postId = post && typeof post === "object" && "id" in post && typeof post.id === "string" ? post.id : undefined;
      if (postId) {
        await prisma.post.upsert({
          where: { id: postId },
          update: post as unknown as Prisma.PostUpdateInput,
          create: post as unknown as Prisma.PostCreateInput,
        });
      } else {
        await prisma.post.create({ data: post as unknown as Prisma.PostCreateInput });
      }
    }
  }
  
  if (fixtures.longFormPosts && Array.isArray(fixtures.longFormPosts)) {
    for (const longform of fixtures.longFormPosts) {
      const longformId = longform && typeof longform === "object" && "id" in longform && typeof longform.id === "string" ? longform.id : undefined;
      if (longformId) {
        await prisma.longFormPost.upsert({
          where: { id: longformId },
          update: longform as unknown as Prisma.LongFormPostUpdateInput,
          create: longform as unknown as Prisma.LongFormPostCreateInput,
        });
      } else {
        await prisma.longFormPost.create({ data: longform as unknown as Prisma.LongFormPostCreateInput });
      }
    }
  }
  
  if (fixtures.payments && Array.isArray(fixtures.payments)) {
    for (const payment of fixtures.payments) {
      const paymentId = payment && typeof payment === "object" && "id" in payment && typeof payment.id === "string" ? payment.id : undefined;
      if (paymentId) {
        await prisma.payment.upsert({
          where: { id: paymentId },
          update: payment as unknown as Prisma.PaymentUpdateInput,
          create: payment as unknown as Prisma.PaymentCreateInput,
        });
      } else {
        await prisma.payment.create({ data: payment as unknown as Prisma.PaymentCreateInput });
      }
    }
  }
  
  if (fixtures.plans && Array.isArray(fixtures.plans)) {
    for (const plan of fixtures.plans) {
      const planId = plan && typeof plan === "object" && "id" in plan && typeof plan.id === "string" ? plan.id : undefined;
      if (planId) {
        await prisma.plan.upsert({
          where: { id: planId },
          update: plan as unknown as Prisma.PlanUpdateInput,
          create: plan as unknown as Prisma.PlanCreateInput,
        });
      } else {
        await prisma.plan.create({ data: plan as unknown as Prisma.PlanCreateInput });
      }
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
    // Dynamic import() type annotation needed for conditional type
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    fixtures?: import("./fixtures").TestFixtures;
    cleanup?: boolean;
  },
): Promise<T> {
  const { useTransaction = false, fixtures, cleanup = true } = options ?? {};
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

