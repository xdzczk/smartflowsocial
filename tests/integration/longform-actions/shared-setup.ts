/**
 * Shared setup for longform action tests
 *
 * Provides common mocks and utilities for longform action handler tests
 */

import { vi } from "vitest";

// Mock global fetch
global.fetch = vi.fn();

// Mock Prisma - use vi.hoisted to allow top-level variables in mocks
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma2 = {
    $use: vi.fn(),
    queueType: {
      findFirst: vi.fn(),
    },
  };
  return { mockPrisma: mockPrisma2 };
});

export { mockPrisma };

vi.mock("~/lib/prisma.server", () => ({
  prisma: mockPrisma,
}));

// Mock dependencies (longform.server: createLongFormEvent, generateArticleIdentifier only)
vi.mock("~/features/posts/longform.server", () => ({
  createLongFormEvent: vi.fn(),
  generateArticleIdentifier: vi.fn((t: string) =>
    t.toLowerCase().replace(/\s+/g, "-").substring(0, 64)
  ),
}));

vi.mock("~/features/upload/s3.server", () => ({
  createUploadHandler: vi.fn(() => vi.fn()),
  uploadBufferToS3: vi.fn(),
}));

vi.mock("~/lib/markdown-sanitizer.server", () => ({
  sanitizeMarkdown: vi.fn((content: string) => `Sanitized: ${content}`),
  generateSummary: vi.fn((content: string) => {
    const contentStr = typeof content === "string" ? content : String(content);
    return `Summary of ${contentStr.substring(0, 50)}`;
  }),
}));

// Mock use cases
export const mockCreateLongFormPostExecute = vi.fn();
export const mockPublishLongFormNowExecute = vi.fn();
export const mockScheduleLongFormPostExecute = vi.fn();

vi.mock("~/features/posts/server", () => ({
  CreateLongFormPostUseCase: class {
    execute = mockCreateLongFormPostExecute;
  },
  PublishLongFormNowUseCase: class {
    execute = mockPublishLongFormNowExecute;
  },
  ScheduleLongFormPostUseCase: class {
    execute = mockScheduleLongFormPostExecute;
  },
}));

vi.mock("~/lib/correlation-context.server", () => ({
  extractCorrelationId: vi.fn(() => "test-correlation-id"),
}));

vi.mock("~/features/posts/services/queue-type-resolver.server", () => ({
  resolveQueueTypeId: vi.fn((userId, queueTypeId, queueType) => {
    if (queueTypeId) return Promise.resolve(queueTypeId);
    if (queueType === "posts") return Promise.resolve("queue-1");
    if (queueType === "Unassigned" || !queueType) return Promise.resolve(null);
    return Promise.resolve(null);
  }),
}));

vi.mock("~/features/user", () => ({
  getUserById: vi.fn(),
  getQueueTypes: vi.fn(),
  getHashTagPresetById: vi.fn(),
  getQueueTypeByNameForUser: vi.fn(),
}));

// Store FormData objects for mock access
export const formDataStore = new Map<string, FormData>();

// Mock Remix upload handlers
vi.mock("@remix-run/node", async () => {
  const actual = await vi.importActual("@remix-run/node");
  return {
    ...actual,
    unstable_composeUploadHandlers: vi.fn((...handlers) => {
      return async (part: {
        filename?: string;
        name?: string;
        data: AsyncIterable<Uint8Array>;
      }) => {
        if (part.filename) {
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
        return part.data;
      };
    }),
    unstable_createMemoryUploadHandler: vi.fn(() => vi.fn()),
    unstable_parseMultipartFormData: vi.fn(
      async (
        request: { url?: string; formData?: () => Promise<FormData> },
        _uploadHandler: unknown
      ) => {
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
          formDataStore.delete(url);
          return storedFormData;
        }

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
          return new FormData();
        }
      }
    ),
  };
});
