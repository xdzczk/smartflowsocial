/**
 * Test scenario builders
 * Provides pre-configured test scenarios to reduce duplication
 */

import { vi } from "vitest";

import { createMockUser, createMockQueueType } from "./mock-helpers";

/**
 * Common test scenario configurations
 */
export interface TestScenarioConfig {
  userId?: string;
  userRelays?: string[];
  queueTypes?: Array<{ id: string; name: string }>;
  useCaseMocks?: {
    createPost?: ReturnType<typeof vi.fn>;
    publishNow?: ReturnType<typeof vi.fn>;
    schedulePost?: ReturnType<typeof vi.fn>;
  };
}

/**
 * Build a standard action handler test scenario
 */
export function buildActionHandlerScenario(config: TestScenarioConfig = {}) {
  const {
    userId = "user-123",
    userRelays = ["wss://relay1.com", "wss://relay2.com"],
    queueTypes = [
      { id: "queue-1", name: "posts" },
      { id: "unassigned", name: "Unassigned" },
    ],
    useCaseMocks = {},
  } = config;

  // Setup user mocks
  const getUserById = vi
    .fn()
    .mockResolvedValue(createMockUser({ id: userId, userRelays }));

  const getQueueTypes = vi
    .fn()
    .mockResolvedValue(queueTypes.map((qt) => createMockQueueType(qt)));

  const getQueueTypeByNameForUser = vi
    .fn()
    .mockResolvedValue(
      createMockQueueType(queueTypes[0] ?? { id: "queue-1", name: "posts" })
    );

  // Setup use case mocks
  const {
    createPost = vi.fn().mockResolvedValue({ post: { id: "post-123" } }),
    publishNow = vi.fn().mockResolvedValue(undefined),
    schedulePost = vi.fn().mockResolvedValue(undefined),
  } = useCaseMocks;

  return {
    userId,
    getUserById,
    getQueueTypes,
    getQueueTypeByNameForUser,
    createPost,
    publishNow,
    schedulePost,
  };
}

/**
 * Build a standard payment test scenario
 */
export function buildPaymentTestScenario(
  config: {
    userId?: string;
    planId?: string;
    paymentId?: string;
  } = {}
) {
  const {
    userId = "user-123",
    planId = "plan-123",
    paymentId = "payment-123",
  } = config;

  return {
    userId,
    planId,
    paymentId,
    setupEnv: () => {
      process.env["OWNER_NWC"] = "test-nwc-credentials";
    },
    cleanupEnv: () => {
      delete process.env["OWNER_NWC"];
    },
  };
}

/**
 * Build a standard database integration test scenario
 */
export async function buildDatabaseTestScenario() {
  const { createTestUser, cleanupTestUser } =
    await import("./integration-test-setup");

  const user = await createTestUser();

  return {
    userId: user.id,
    cleanup: async () => {
      await cleanupTestUser(user.id);
    },
  };
}
