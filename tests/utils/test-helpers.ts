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
 * Create a mock user ID for testing
 */
export const TEST_USER_ID = "test-user-123";

/**
 * Create a mock post ID for testing
 */
export const TEST_POST_ID = "test-post-123";

/**
 * Create a mock longform post ID for testing
 */
export const TEST_LONGFORM_ID = "test-longform-123";

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

