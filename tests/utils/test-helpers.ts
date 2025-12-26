/**
 * Test utilities and helpers
 * Common functions for creating test data and mocks
 */

/**
 * Create a FormData object with the given entries
 */
export function createFormData(entries: Record<string, string | string[]>): FormData {
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
  additionalData: Record<string, string | string[]> = {},
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
 * Re-export mock helpers
 * Note: TEST_USER_ID, TEST_POST_ID, TEST_LONGFORM_ID are exported from mock-helpers
 */
export * from "./mock-helpers";

