/**
 * Test utilities and helpers
 * Common functions for creating test data and mocks
 */

/**
 * Create a FormData object with the given entries
 */
export function createFormData(
  entries: Record<string, string | string[]>
): FormData {
  const formData = new FormData();

  for (const [key, value] of Object.entries(entries)) {
    if (Array.isArray(value)) {
      value.forEach((v) => formData.append(key, v));
    } else {
      formData.append(key, value);
    }
  }

  return formData;
}

/**
 * Create a FormData object for action handlers
 */
export function createActionFormData(
  action: string,
  additionalData: Record<string, string | string[]> = {}
): FormData {
  return createFormData({
    _action: action,
    ...additionalData,
  });
}

/**
 * Alias for createFormData (for backward compatibility)
 */
export const createMockFormData = createFormData;

/**
 * Helper to create multiple post IDs
 */
export function createPostIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `post-${i + 1}`);
}

/**
 * Re-export factory functions for convenience
 * Use factories for creating complex test data
 *
 * Example:
 *   import { postFactory, userFactory } from "~/tests/utils/test-helpers";
 *   const post = postFactory.draft();
 *   const user = userFactory.basic();
 */
export {
  postFactory,
  longFormPostFactory,
  userFactory,
  queueTypeFactory,
  hashTagPresetFactory,
  paymentFactory,
  templateFactory,
  assetFactory,
} from "../factories";

/**
 * Re-export scheduling test helpers
 * Note: Exports everything except TEST_USER_ID which is also in mock-helpers
 */
export {
  BASE_TIME,
  createQueueType,
  createIntervalQueueType,
  createFixedSlotsQueueType,
  createTestDate,
  createDateAtTime,
} from "./scheduling-test-helpers";

/**
 * Re-export mock helpers (using explicit exports to avoid conflicts)
 * Note: TEST_USER_ID, TEST_POST_ID, TEST_LONGFORM_ID are exported from mock-helpers
 */
export {
  TEST_USER_ID,
  TEST_POST_ID,
  TEST_QUEUE_TYPE_ID,
  TEST_LONGFORM_ID,
  createMockPrisma,
  createMockUser,
  createMockQueueType,
  createMockPost,
} from "./mock-helpers";

/**
 * Re-export payment test helpers (excluding conflicting exports)
 */
export {
  TEST_PLAN_ID,
  TEST_PAYMENT_ID,
  TEST_SUBSCRIPTION_ID,
  createMockPaymentPrisma,
  resetMockPaymentPrismaTransaction,
  createMockPlan,
  createMockPayment,
  createMockSubscription,
  createMockLN,
  type MockLNOptions,
} from "./payment-test-helpers";

/**
 * Re-export action test helpers
 */
export * from "./action-test-helpers";

/**
 * Re-export integration test setup helpers
 */
export * from "./integration-test-setup";

/**
 * Re-export test scenario builders
 */
export * from "./test-scenario-builders";

/**
 * Re-export Nostr test helpers
 */
export * from "./nostr-test-helpers";

/**
 * Create a valid user object that matches userSchema
 */
export function createValidUserMock(
  overrides: Partial<{
    id: string;
    npub: string;
    timezone: string | null;
    scheduleInterval: Array<string | number>;
  }> = {}
): {
  id: string;
  npub: string;
  createdAt: string;
  updatedAt: string;
  isEnabled: boolean;
  timezone: string | null;
  userRelays: string[];
  giveawayBlackListed: string[];
  uploadProvider: "S3" | "BLOSSOM_PRIMAL" | "BLOSSOM_BLOSSTR";
  scheduleInterval: Array<string | number>;
  pendingParentRequests: string[];
} {
  return {
    id: overrides.id ?? "user-123",
    npub: overrides.npub ?? "npub123",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isEnabled: true,
    timezone: overrides.timezone ?? "UTC",
    userRelays: [],
    giveawayBlackListed: [],
    uploadProvider: "S3",
    scheduleInterval: overrides.scheduleInterval ?? [],
    pendingParentRequests: [],
  };
}

/**
 * Create a minimal valid post DTO that matches postDTOSchema
 */
export function createValidPostDTOMock(
  overrides: Partial<{
    id: string;
    userId: string;
    caption: string | null;
    content: string | null;
    postType: "IMAGE" | "CAROUSEL" | "TEXT" | "VIDEO";
    status: "DRAFT" | "ACTIVE" | "SCHEDULED" | "PAUSED" | "POSTED" | "FAILED";
    scheduledFor: string | null;
    postedAt: string | null;
  }> = {}
): {
  id: string;
  fileUrl: string[];
  scheduledFor: string | null;
  postedAt: string | null;
  isPosted: boolean;
  isScheduled: boolean;
  postType: "IMAGE" | "CAROUSEL" | "TEXT" | "VIDEO";
  repost: boolean;
  isQuotedPost: boolean;
  isRecyclable: boolean;
  createdAt: string;
  updatedAt: string;
  draft: boolean;
  status: "DRAFT" | "ACTIVE" | "SCHEDULED" | "PAUSED" | "POSTED" | "FAILED";
  tags: string[];
  manual_override: boolean;
  userId: string;
  caption: string | null;
  content: string | null;
} {
  return {
    id: overrides.id ?? "post-1",
    fileUrl: [],
    scheduledFor: overrides.scheduledFor ?? null,
    postedAt: overrides.postedAt ?? null,
    isPosted: false,
    isScheduled: overrides.status === "SCHEDULED",
    postType: overrides.postType ?? "TEXT",
    repost: false,
    isQuotedPost: false,
    isRecyclable: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    draft: overrides.status === "DRAFT",
    status: overrides.status ?? "SCHEDULED",
    tags: [],
    manual_override: false,
    userId: overrides.userId ?? "user-123",
    caption: overrides.caption ?? null,
    content: overrides.content ?? null,
  };
}
