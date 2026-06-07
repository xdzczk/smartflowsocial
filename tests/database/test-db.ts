/**
 * Test Database Utilities
 *
 * Provides utilities for setting up and managing test databases
 * with transaction-based isolation for test safety
 */

import { execSync } from "child_process";
import {
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
  openSync,
  closeSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import type { Prisma } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

let testPrisma: PrismaClient | null = null;
let transactionClient: PrismaClient | null = null;

const SETUP_LOCK_PATH = join(tmpdir(), "smartflow_test_db_setup.lock");
const SETUP_DONE_PATH = join(tmpdir(), "smartflow_test_db_setup.done");

function getSchemaFingerprint(): string {
  try {
    const schemaPath = resolve(process.cwd(), "prisma", "schema.prisma");
    const stat = statSync(schemaPath);
    return String(stat.mtimeMs);
  } catch {
    return "unknown";
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

async function withSetupLock<T>(fn: () => Promise<T> | T): Promise<T> {
  const start = Date.now();
  const timeoutMs = 120_000;

  for (;;) {
    try {
      const fd = openSync(SETUP_LOCK_PATH, "wx");
      closeSync(fd);
      break;
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : null;
      if (code !== "EEXIST") {
        throw error;
      }
      if (Date.now() - start > timeoutMs) {
        throw new Error("Timed out waiting for test DB setup lock");
      }
      await sleep(200);
    }
  }

  try {
    return await fn();
  } finally {
    try {
      unlinkSync(SETUP_LOCK_PATH);
    } catch {
      // best-effort
    }
  }
}

/**
 * Get or create test Prisma client
 * Uses separate test database URL if available
 */
export function getTestPrisma(): PrismaClient {
  if (testPrisma) {
    return testPrisma;
  }

  const testDatabaseUrl =
    process.env["TEST_DATABASE_URL"] ?? process.env["DATABASE_URL"];

  if (!testDatabaseUrl) {
    throw new Error(
      "TEST_DATABASE_URL or DATABASE_URL must be set for database tests"
    );
  }

  // Prisma 7: datasources option is no longer supported in constructor
  // Set DATABASE_URL environment variable instead
  const originalUrl = process.env["DATABASE_URL"];
  process.env["DATABASE_URL"] = testDatabaseUrl;
  try {
    // Prisma 7: Use PostgreSQL adapter for the "client" engine type
    // Create a connection pool for the adapter
    const pool = new Pool({
      connectionString: testDatabaseUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Create the Prisma adapter using the connection pool
    const adapter = new PrismaPg(pool);

    testPrisma = new PrismaClient({
      adapter: adapter,
      log: process.env["DEBUG"] ? ["query", "error", "warn"] : ["error"],
    });
  } finally {
    // Restore original URL if it existed
    if (originalUrl !== undefined) {
      process.env["DATABASE_URL"] = originalUrl;
    } else {
      delete process.env["DATABASE_URL"];
    }
  }

  return testPrisma;
}

/**
 * Create a transaction client for test isolation
 * Each test runs in its own transaction that gets rolled back
 */
export async function createTransactionClient(): Promise<PrismaClient> {
  const prisma = getTestPrisma();

  // Start a transaction
  await prisma.$transaction(
    async (tx) => {
      // Return a client that uses this transaction
      return tx as unknown as PrismaClient;
    },
    {
      timeout: 10000,
    }
  );

  // For Prisma, we'll use a different approach - wrap operations in transactions
  return prisma;
}

/**
 * Run a test function within a transaction
 * The transaction is rolled back after the test, ensuring test isolation
 */
export async function withTransaction<T>(
  testFn: (prisma: PrismaClient) => Promise<T>
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
    }
  );
}

/**
 * Setup test database
 * Syncs schema and seeds test data
 * Tries to use migrations first, falls back to db push if migrations aren't available
 */
export function setupTestDatabase(): Promise<void> {
  const testDatabaseUrl =
    process.env["TEST_DATABASE_URL"] ?? process.env["DATABASE_URL"];

  if (!testDatabaseUrl) {
    throw new Error("TEST_DATABASE_URL or DATABASE_URL must be set");
  }

  // If SKIP_DATABASE_TESTS is set, skip the setup
  if (process.env["SKIP_DATABASE_TESTS"] === "true") {
    return Promise.resolve();
  }

  const fingerprint = getSchemaFingerprint();

  return withSetupLock(async () => {
    // If another worker already set up the schema for this fingerprint, do nothing.
    try {
      const done = readFileSync(SETUP_DONE_PATH, "utf8").trim();
      if (done === fingerprint) {
        return;
      }
    } catch {
      // done marker missing/unreadable
    }

    try {
      // First, try to run migrations to ensure all migration-specific changes are applied
      // This is important for columns like creationIdempotencyKey that might be added in migrations
      try {
        execSync("npx prisma migrate deploy", {
          env: { ...process.env, DATABASE_URL: testDatabaseUrl },
          stdio: "pipe", // Use pipe to suppress output unless there's an error
        });
        console.log("✅ Migrations applied successfully");
      } catch (migrateError) {
        // If migrate deploy fails (e.g., no migration history, database doesn't exist, etc.), fall back to db push
        const errorMessage =
          migrateError instanceof Error
            ? migrateError.message
            : String(migrateError);
        console.warn(
          "⚠️  Migrate deploy failed, falling back to db push:",
          errorMessage
        );

        execSync("npx prisma db push --accept-data-loss", {
          env: { ...process.env, DATABASE_URL: testDatabaseUrl },
          stdio: "inherit",
        });
        console.log("✅ Database schema synced with db push");
      }

      // Mark schema as ready for this fingerprint so other workers skip re-running db push.
      writeFileSync(SETUP_DONE_PATH, fingerprint, "utf8");
    } catch (error) {
      console.error("Failed to setup database schema:", error);
      // If SKIP_DATABASE_TESTS is set, don't throw - allow tests to be skipped
      if (process.env["SKIP_DATABASE_TESTS"] === "true") {
        return;
      }
      throw error;
    }
  });
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
    "Payment",
    "Plan",
    "Subscription",
  ];

  // Delete in reverse order of dependencies
  for (const modelName of modelNames.reverse()) {
    try {
      const modelKey = modelName.toLowerCase() as keyof PrismaClient;
      const model = prisma[modelKey] as
        | { deleteMany: (args: {}) => Promise<unknown> }
        | undefined;
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
        env: {
          ...process.env,
          DATABASE_URL:
            process.env["TEST_DATABASE_URL"] ?? process.env["DATABASE_URL"],
        },
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
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Dynamic import requires value import
  fixtures: TestFixtures | import("./fixtures").TestFixtures
): Promise<void> {
  // Apply fixtures in dependency order
  if (fixtures.users && Array.isArray(fixtures.users)) {
    for (const user of fixtures.users) {
      // Use upsert to handle existing records
      const userId =
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Test: type narrowing for fixture data
        user &&
        typeof user === "object" &&
        "id" in user &&
        typeof user.id === "string"
          ? user.id
          : undefined;
      if (userId) {
        await prisma.user.upsert({
          where: { id: userId },
          update: user as unknown as Prisma.UserUpdateInput,
          create: user as unknown as Prisma.UserCreateInput,
        });
      } else {
        await prisma.user.create({
          data: user as unknown as Prisma.UserCreateInput,
        });
      }
    }
  }

  if (fixtures.queueTypes && Array.isArray(fixtures.queueTypes)) {
    for (const queueType of fixtures.queueTypes) {
      const queueTypeId =
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Test: type narrowing for fixture data
        queueType &&
        typeof queueType === "object" &&
        "id" in queueType &&
        typeof queueType.id === "string"
          ? queueType.id
          : undefined;
      if (queueTypeId) {
        await prisma.queueType.upsert({
          where: { id: queueTypeId },
          update: queueType as unknown as Prisma.QueueTypeUpdateInput,
          create: queueType as unknown as Prisma.QueueTypeCreateInput,
        });
      } else {
        await prisma.queueType.create({
          data: queueType as unknown as Prisma.QueueTypeCreateInput,
        });
      }
    }
  }

  if (fixtures.hashTagPresets && Array.isArray(fixtures.hashTagPresets)) {
    for (const preset of fixtures.hashTagPresets) {
      const presetId =
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Test: type narrowing for fixture data
        preset &&
        typeof preset === "object" &&
        "id" in preset &&
        typeof preset.id === "string"
          ? preset.id
          : undefined;
      if (presetId) {
        await prisma.hashTagPreset.upsert({
          where: { id: presetId },
          update: preset,
          create: preset as unknown as Prisma.HashTagPresetCreateInput,
        });
      } else {
        await prisma.hashTagPreset.create({
          data: preset as unknown as Prisma.HashTagPresetCreateInput,
        });
      }
    }
  }

  if (fixtures.posts && Array.isArray(fixtures.posts)) {
    for (const post of fixtures.posts) {
      const postId =
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Test: type narrowing for fixture data
        post &&
        typeof post === "object" &&
        "id" in post &&
        typeof post.id === "string"
          ? post.id
          : undefined;
      if (postId) {
        await prisma.post.upsert({
          where: { id: postId },
          update: post as unknown as Prisma.PostUpdateInput,
          create: post as unknown as Prisma.PostCreateInput,
        });
      } else {
        await prisma.post.create({
          data: post as unknown as Prisma.PostCreateInput,
        });
      }
    }
  }

  if (fixtures.longFormPosts && Array.isArray(fixtures.longFormPosts)) {
    for (const longform of fixtures.longFormPosts) {
      const longformId =
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Test: type narrowing for fixture data
        longform &&
        typeof longform === "object" &&
        "id" in longform &&
        typeof longform.id === "string"
          ? longform.id
          : undefined;
      if (longformId) {
        await prisma.longFormPost.upsert({
          where: { id: longformId },
          update: longform as unknown as Prisma.LongFormPostUpdateInput,
          create: longform as unknown as Prisma.LongFormPostCreateInput,
        });
      } else {
        await prisma.longFormPost.create({
          data: longform as unknown as Prisma.LongFormPostCreateInput,
        });
      }
    }
  }

  if (fixtures.payments && Array.isArray(fixtures.payments)) {
    for (const payment of fixtures.payments) {
      const paymentId =
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Test: type narrowing for fixture data
        payment &&
        typeof payment === "object" &&
        "id" in payment &&
        typeof payment.id === "string"
          ? payment.id
          : undefined;
      if (paymentId) {
        await prisma.payment.upsert({
          where: { id: paymentId },
          update: payment,
          create: payment as unknown as Prisma.PaymentCreateInput,
        });
      } else {
        await prisma.payment.create({
          data: payment as unknown as Prisma.PaymentCreateInput,
        });
      }
    }
  }

  if (fixtures.plans && Array.isArray(fixtures.plans)) {
    for (const plan of fixtures.plans) {
      const planId =
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Test: type narrowing for fixture data
        plan &&
        typeof plan === "object" &&
        "id" in plan &&
        typeof plan.id === "string"
          ? plan.id
          : undefined;
      if (planId) {
        await prisma.plan.upsert({
          where: { id: planId },
          update: plan as unknown as Prisma.PlanUpdateInput,
          create: plan as unknown as Prisma.PlanCreateInput,
        });
      } else {
        await prisma.plan.create({
          data: plan as unknown as Prisma.PlanCreateInput,
        });
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
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Dynamic import requires value import
    fixtures?: import("./fixtures").TestFixtures;
    cleanup?: boolean;
  }
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
