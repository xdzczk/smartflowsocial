/**
 * Shared setup helpers for integration tests
 * Reduces duplication in beforeEach/afterEach patterns
 */

import { vi } from "vitest";

import { prisma } from "~/lib/prisma.server";

/**
 * Common test IDs
 */
export const TEST_USER_ID = "user-123";
export const TEST_PLAN_ID = "plan-123";
export const TEST_PAYMENT_ID = "payment-123";

/**
 * Setup options for integration tests
 */
export interface IntegrationTestSetupOptions {
  createUser?: boolean;
  clearMocks?: boolean;
  setupEnv?: Record<string, string>;
}

/**
 * Create a test user in the database
 */
export async function createTestUser(
  overrides: {
    npub?: string;
    isEnabled?: boolean;
  } = {}
) {
  return await prisma.user.create({
    data: {
      npub: overrides.npub ?? `test-${Date.now()}`,
      isEnabled: overrides.isEnabled ?? true,
    },
  });
}

/**
 * Clean up test user and related data
 */
export async function cleanupTestUser(userId: string) {
  // Clean up in correct order (foreign key constraints)
  await prisma.outboxEvent.deleteMany({
    where: {
      OR: [
        {
          aggregateId: {
            in: await prisma.post
              .findMany({ where: { userId }, select: { id: true } })
              .then((posts) => posts.map((p) => p.id)),
          },
        },
        {
          aggregateId: {
            in: await prisma.longFormPost
              .findMany({ where: { userId }, select: { id: true } })
              .then((posts) => posts.map((p) => p.id)),
          },
        },
      ],
    },
  });

  await prisma.postStateTransition.deleteMany({
    where: { post: { userId } },
  });

  await prisma.post.deleteMany({
    where: { userId },
  });

  await prisma.longFormPost.deleteMany({
    where: { userId },
  });

  await prisma.user.delete({
    where: { id: userId },
  });
}

/**
 * Setup common test environment
 */
export function setupTestEnvironment(envVars: Record<string, string> = {}) {
  const originalEnv: Record<string, string | undefined> = {};

  for (const [key, value] of Object.entries(envVars)) {
    originalEnv[key] = process.env[key];
    process.env[key] = value;
  }

  return () => {
    // Restore original environment
    for (const [key, originalValue] of Object.entries(originalEnv)) {
      if (originalValue === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalValue;
      }
    }
  };
}

/**
 * Common beforeEach setup for integration tests
 */
export async function setupIntegrationTest(
  options: IntegrationTestSetupOptions = {}
) {
  const { createUser = false, clearMocks = true, setupEnv = {} } = options;

  if (clearMocks) {
    vi.clearAllMocks();
  }

  const restoreEnv = setupTestEnvironment(setupEnv);

  let userId: string | undefined;
  if (createUser) {
    const user = await createTestUser();
    userId = user.id;
  }

  return {
    userId,
    restoreEnv,
    cleanup: async () => {
      if (userId) {
        await cleanupTestUser(userId);
      }
      restoreEnv();
    },
  };
}

/**
 * Common afterEach cleanup for integration tests
 */
export async function cleanupIntegrationTest(cleanupFn: () => Promise<void>) {
  await cleanupFn();
}
