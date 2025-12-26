/**
 * Shared mock helpers for integration tests
 * 
 * These helpers provide common mock setup patterns to reduce duplication
 * across large integration tests.
 */

import { vi } from "vitest";

/**
 * Common test IDs
 */
export const TEST_USER_ID = "user-123";
export const TEST_POST_ID = "post-123";
export const TEST_QUEUE_TYPE_ID = "queue-123";
export const TEST_LONGFORM_ID = "longform-123";

/**
 * Create a mock Prisma client for testing
 * Use this in tests that need to mock database operations
 */
export function createMockPrisma() {
  return {
    post: {
      create: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    longFormPost: {
      create: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    queueType: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    subscription: {
      findFirst: vi.fn(),
    },
  };
}

/**
 * Setup default mocks for user-related functions
 * Use this in beforeEach to set up common user mocks
 */
export function setupUserMocks(mocks: {
  getUserById?: ReturnType<typeof vi.fn>;
  getQueueTypes?: ReturnType<typeof vi.fn>;
  getHashTagPresetById?: ReturnType<typeof vi.fn>;
}) {
  const {
    getUserById = vi.fn(),
    getQueueTypes = vi.fn(),
    getHashTagPresetById = vi.fn(),
  } = mocks;

  // Default mock responses
  if (!getUserById.mock.calls.length) {
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: TEST_USER_ID,
      userRelays: ["wss://relay1.com", "wss://relay2.com"],
      showHashTagsinPosts: true,
    });
  }

  if (!getQueueTypes.mock.calls.length) {
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: TEST_QUEUE_TYPE_ID,
        name: "posts",
        hashTagPreset: { id: "preset-1", tags: "#default #tags" },
      },
    ]);
  }

  if (!getHashTagPresetById.mock.calls.length) {
    (getHashTagPresetById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "preset-1",
      tags: "#custom #tags",
    });
  }

  return { getUserById, getQueueTypes, getHashTagPresetById };
}

/**
 * Setup default mocks for post-related functions
 */
export function setupPostMocks(mocks: {
  createPost?: ReturnType<typeof vi.fn>;
  getPostById?: ReturnType<typeof vi.fn>;
  updatePost?: ReturnType<typeof vi.fn>;
}) {
  const {
    createPost = vi.fn(),
    getPostById = vi.fn(),
    updatePost = vi.fn(),
  } = mocks;

  // Default mock responses
  if (!createPost.mock.calls.length) {
    (createPost as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: TEST_POST_ID,
      signedEvent: { id: "event-123" },
    });
  }

  return { createPost, getPostById, updatePost };
}

/**
 * Setup default mocks for fetch (Nostr publisher, etc.)
 */
export function setupFetchMock(status: number = 200, ok: boolean = true, jsonResponse: any = {}) {
  const mockFetch = vi.fn();
  global.fetch = mockFetch as any;
  
  // Default successful response
  mockFetch.mockResolvedValue({
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    json: async () => jsonResponse,
  });

  return mockFetch;
}

/**
 * Create a mock user object for testing
 */
export function createMockUser(overrides: any = {}) {
  return {
    id: TEST_USER_ID,
    userRelays: ["wss://relay1.com", "wss://relay2.com"],
    showHashTagsinPosts: true,
    filterMuted: false,
    hidePostsFromLowTrustUsers: false,
    mutedList: { npubs: [] },
    npub: "npub123",
    ...overrides,
  };
}

/**
 * Create a mock queue type object for testing
 */
export function createMockQueueType(overrides: any = {}) {
  return {
    id: TEST_QUEUE_TYPE_ID,
    name: "posts",
    isEnabled: true,
    hashTagPreset: null,
    ...overrides,
  };
}

/**
 * Create a mock post object for testing
 */
export function createMockPost(overrides: any = {}) {
  return {
    id: TEST_POST_ID,
    userId: TEST_USER_ID,
    content: "Test content",
    caption: "Test caption",
    fileUrl: [],
    postType: "TEXT" as const,
    tags: [],
    isScheduled: false,
    isPosted: false,
    signedEvent: { id: "event-123" },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Clear all mocks (useful in beforeEach)
 */
export function clearAllMocks() {
  vi.clearAllMocks();
}

