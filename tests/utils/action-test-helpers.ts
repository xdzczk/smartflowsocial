/**
 * Action handler test helpers
 *
 * Provides reusable mocks and builders for action handler tests
 * to reduce duplication in large test files like newlongform-action.test.ts
 */

import { vi } from "vitest";

/**
 * Create a mock FormData store for Remix upload handler tests
 * This allows tests to set FormData before creating Request objects
 */
export class FormDataStore {
  private readonly store = new Map<string, FormData>();

  set(url: string, formData: FormData): void {
    this.store.set(url, formData);
  }

  get(url: string): FormData | undefined {
    return this.store.get(url);
  }

  delete(url: string): void {
    this.store.delete(url);
  }

  clear(): void {
    this.store.clear();
  }
}

/**
 * Create mock Remix upload handlers
 */
export function createMockRemixUploadHandlers(formDataStore: FormDataStore) {
  return {
    unstable_composeUploadHandlers: vi.fn((...handlers) => {
      return async (part: {
        filename?: string;
        name?: string;
        data: AsyncIterable<Uint8Array>;
      }) => {
        if (part.filename) {
          // It's a file - process through the first handler (S3 upload handler)
          const firstHandler = handlers[0] as
            | ((part: {
                filename?: string;
                name?: string;
                data: AsyncIterable<Uint8Array>;
              }) => Promise<unknown>)
            | undefined;
          if (firstHandler) {
            return await firstHandler(part);
          }
        }
        // For non-file parts, return the value as-is
        return part.data;
      };
    }),
    unstable_createMemoryUploadHandler: vi.fn(() => vi.fn()),
    unstable_parseMultipartFormData: vi.fn(
      async (
        request: { url?: string; formData?: () => Promise<FormData> },
        _uploadHandler: unknown
      ) => {
        // Try to get FormData from store first (set by test using request URL as key)
        const url =
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Defensive check for request type
          request &&
          typeof request === "object" &&
          "url" in request &&
          typeof request.url === "string"
            ? request.url
            : String(request.url ?? "");
        const storedFormData = formDataStore.get(url);
        if (storedFormData) {
          formDataStore.delete(url); // Clean up after use
          return storedFormData;
        }

        // Fallback: try to parse from request
        try {
          const formData =
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Defensive check for request type
            request &&
            typeof request === "object" &&
            "formData" in request &&
            typeof request.formData === "function"
              ? await request.formData()
              : new FormData();
          return formData;
        } catch (_error) {
          // If parsing fails, return empty FormData
          return new FormData();
        }
      }
    ),
  };
}

/**
 * Create mock use case classes
 */
export function createMockUseCase(executeFn: ReturnType<typeof vi.fn>) {
  return class {
    execute = executeFn;
  };
}

/**
 * Setup default use case mocks
 */
export interface UseCaseMocks {
  createLongFormPost?: ReturnType<typeof vi.fn>;
  publishLongFormNow?: ReturnType<typeof vi.fn>;
  scheduleLongFormPost?: ReturnType<typeof vi.fn>;
  createPost?: ReturnType<typeof vi.fn>;
  publishNow?: ReturnType<typeof vi.fn>;
  schedulePost?: ReturnType<typeof vi.fn>;
}

export function setupUseCaseMocks(mocks: UseCaseMocks = {}) {
  const {
    createLongFormPost = vi.fn().mockResolvedValue({
      post: { id: "longform-123", title: "Test Post", isPublished: false },
      needsScheduling: false,
    }),
    publishLongFormNow = vi.fn().mockResolvedValue(undefined),
    scheduleLongFormPost = vi.fn().mockResolvedValue(undefined),
    createPost = vi.fn().mockResolvedValue({ post: { id: "post-123" } }),
    publishNow = vi.fn().mockResolvedValue(undefined),
    schedulePost = vi.fn().mockResolvedValue(undefined),
  } = mocks;

  return {
    createLongFormPost,
    publishLongFormNow,
    scheduleLongFormPost,
    createPost,
    publishNow,
    schedulePost,
  };
}

/**
 * Setup default user mocks for action handlers
 */
export function setupActionUserMocks(
  overrides: {
    getUserById?: ReturnType<typeof vi.fn>;
    getQueueTypes?: ReturnType<typeof vi.fn>;
    getHashTagPresetById?: ReturnType<typeof vi.fn>;
    getQueueTypeByNameForUser?: ReturnType<typeof vi.fn>;
  } = {}
) {
  const {
    getUserById,
    getQueueTypes,
    getHashTagPresetById,
    getQueueTypeByNameForUser,
  } = overrides;

  // Default implementations if not provided
  if (getUserById && !getUserById.mock.calls.length) {
    getUserById.mockResolvedValue({
      id: "user-123",
      userRelays: ["wss://relay1.com", "wss://relay2.com"],
      showHashTagsinPosts: true,
    });
  }

  if (getQueueTypes && !getQueueTypes.mock.calls.length) {
    getQueueTypes.mockResolvedValue([
      { id: "queue-1", name: "posts" },
      { id: "unassigned", name: "Unassigned" },
    ]);
  }

  if (
    getQueueTypeByNameForUser &&
    !getQueueTypeByNameForUser.mock.calls.length
  ) {
    getQueueTypeByNameForUser.mockResolvedValue({
      id: "queue-1",
      name: "posts",
    });
  }

  return {
    getUserById,
    getQueueTypes,
    getHashTagPresetById,
    getQueueTypeByNameForUser,
  };
}

/**
 * Common action test scenarios
 */
export const actionScenarios = {
  /**
   * Setup for image upload action
   */
  imageUpload: {
    formData: (imageUrl: string) => {
      const formData = new FormData();
      formData.append("_action", "upload-image");
      formData.append("imageFile", imageUrl);
      return formData;
    },
  },

  /**
   * Setup for save draft action
   */
  saveDraft: {
    formData: (title: string, content: string) => {
      const formData = new FormData();
      formData.append("_action", "save-draft");
      formData.append("title", title);
      formData.append("content", content);
      return formData;
    },
  },

  /**
   * Setup for publish action
   */
  publish: {
    formData: (
      title: string,
      content: string,
      signedEvent: string,
      nostrEvent: string
    ) => {
      const formData = new FormData();
      formData.append("_action", "publish");
      formData.append("title", title);
      formData.append("content", content);
      formData.append("signedEvent", signedEvent);
      formData.append("nostrEvent", nostrEvent);
      return formData;
    },
  },

  /**
   * Setup for schedule action
   */
  schedule: {
    formData: (title: string, content: string, scheduledFor: string) => {
      const formData = new FormData();
      formData.append("_action", "schedule-longform");
      formData.append("title", title);
      formData.append("content", content);
      formData.append("scheduledFor", scheduledFor);
      return formData;
    },
  },
};
