# Mocking Guidelines

**Date**: 2025-12-25  
**Status**: Comprehensive mocking strategies documented

This guide covers how to mock dependencies in tests.

## Table of Contents

1. [When to Mock](#when-to-mock)
2. [Mocking Prisma](#mocking-prisma)
3. [Mocking External APIs](#mocking-external-apis)
4. [Mocking Remix Utilities](#mocking-remix-utilities)
5. [Mocking File System](#mocking-file-system)
6. [Mocking Environment Variables](#mocking-environment-variables)
7. [Best Practices](#best-practices)

## When to Mock

### Mock External Dependencies

**Always Mock:**
- Database (Prisma)
- External APIs (fetch, HTTP clients)
- File system operations
- Environment variables
- Third-party services

**Example:**
```typescript
// Mock Prisma
vi.mock("~/lib/prisma.server", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
}));
```

### Don't Mock Internal Code

**Don't Mock:**
- Functions you're testing
- Pure utility functions
- Business logic functions
- Type definitions

**Example:**
```typescript
// Don't do this
vi.mock("~/lib/helpers", () => ({
  formatDate: vi.fn(),
}));

// Instead, test the actual function
import { formatDate } from "~/lib/helpers";
```

## Mocking Prisma

### Basic Prisma Mock

**Pattern**: Mock Prisma client with vi.mock

```typescript
import { vi } from "vitest";

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  post: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};

vi.mock("~/lib/prisma.server", () => ({
  prisma: mockPrisma,
}));

describe("User Model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should get user by ID", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-123",
      npub: "npub123",
    });

    const user = await getUserById("user-123");
    expect(user).toBeDefined();
  });
});
```

### Prisma Relations Mock

**Pattern**: Mock Prisma relations

```typescript
const mockPrisma = {
  post: {
    findUnique: vi.fn().mockResolvedValue({
      id: "post-123",
      userId: "user-123",
      queueType: {
        id: "queue-123",
        name: "Test Queue",
      },
    }),
  },
};
```

### Prisma Transaction Mock

**Pattern**: Mock Prisma transactions

```typescript
const mockPrisma = {
  $transaction: vi.fn(async (callback) => {
    return callback(mockPrisma);
  }),
};
```

## Mocking External APIs

### Fetch Mock

**Pattern**: Mock global fetch

```typescript
import { vi } from "vitest";

global.fetch = vi.fn();

describe("getPostStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch stats", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        "event-123": { replies: 5, reposts: 2, likes: 10 },
      }),
    });

    const stats = await getPostStats(["event-123"]);
    expect(stats).toHaveProperty("event-123");
  });
});
```

### HTTP Client Mock

**Pattern**: Mock HTTP client libraries

```typescript
vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));
```

## Mocking Remix Utilities

### Session Mock

**Pattern**: Mock Remix session utilities

```typescript
vi.mock("~/features/auth/session.server", () => ({
  requireUserId: vi.fn().mockResolvedValue("user-123"),
  getUser: vi.fn().mockResolvedValue({
    id: "user-123",
    npub: "npub123",
  }),
  getUserId: vi.fn().mockResolvedValue("user-123"),
}));
```

### FormData Mock

**Pattern**: Use real FormData (no mocking needed)

```typescript
import { createActionFormData } from "~/tests/utils/test-helpers";

const formData = createActionFormData("create", {
  content: "Test content",
});
```

## Mocking File System

### File Upload Mock

**Pattern**: Mock file upload handlers

```typescript
vi.mock("~/features/upload/s3.server", () => ({
  createUploadHandler: vi.fn(() => async (file) => {
    return "https://example.com/uploaded-file.jpg";
  }),
  uploadBufferToS3: vi.fn().mockResolvedValue("https://example.com/file.jpg"),
}));
```

## Mocking Environment Variables

### Environment Variable Mock

**Pattern**: Mock environment variables

```typescript
describe("Feature", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NOSTR_PUBLISHER_URL: "https://test-publisher.com",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should use environment variable", () => {
    expect(process.env.NOSTR_PUBLISHER_URL).toBe("https://test-publisher.com");
  });
});
```

## Best Practices

### 1. Mock Before Imports

**Pattern**: Place mocks before imports

```typescript
import { vi } from "vitest";

// Mock before importing
vi.mock("~/lib/prisma.server", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));

// Import after mocking
import { getUserById } from "~/models/user.server";
```

### 2. Clear Mocks in beforeEach

**Pattern**: Clear mocks between tests

```typescript
beforeEach(() => {
  vi.clearAllMocks();
});
```

### 3. Use Type-Safe Mocks

**Pattern**: Type mocks correctly

```typescript
(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
  id: "user-123",
});
```

### 4. Mock Return Values Match Types

**Pattern**: Ensure mock return values match expected types

```typescript
mockPrisma.user.findUnique.mockResolvedValue({
  id: "user-123",
  npub: "npub123",
  createdAt: new Date(),
  // ... all required fields
});
```

### 5. Use Partial Mocks When Appropriate

**Pattern**: Mock only what you need

```typescript
// Mock only specific functions
vi.spyOn(authModule, "requireUserId").mockResolvedValue("user-123");
```

### 6. Document Mock Behavior

**Pattern**: Add comments explaining mocks

```typescript
// Mock Prisma to avoid database calls in tests
vi.mock("~/lib/prisma.server", () => ({
  prisma: mockPrisma,
}));
```

## Common Mock Patterns

### Async Function Mock

```typescript
const mockFunction = vi.fn().mockResolvedValue("result");
const mockFunction = vi.fn().mockRejectedValue(new Error("error"));
```

### Function Call Verification

```typescript
expect(mockFunction).toHaveBeenCalled();
expect(mockFunction).toHaveBeenCalledWith("arg1", "arg2");
expect(mockFunction).toHaveBeenCalledTimes(1);
```

### Conditional Mocking

```typescript
const mockFunction = vi.fn((arg) => {
  if (arg === "special") {
    return "special-result";
  }
  return "default-result";
});
```

## Anti-Patterns to Avoid

### 1. Over-Mocking

**Don't:**
```typescript
// Mocking everything
vi.mock("~/lib/helpers");
vi.mock("~/lib/utils");
vi.mock("~/lib/date");
```

**Do:**
```typescript
// Only mock external dependencies
vi.mock("~/lib/prisma.server");
```

### 2. Mocking What You're Testing

**Don't:**
```typescript
vi.mock("~/lib/helpers", () => ({
  formatDate: vi.fn(),
}));

// Then test formatDate
```

**Do:**
```typescript
// Test the actual function
import { formatDate } from "~/lib/helpers";
```

### 3. Not Clearing Mocks

**Don't:**
```typescript
// Mocks accumulate between tests
it("test 1", () => { ... });
it("test 2", () => { ... }); // May have stale mock data
```

**Do:**
```typescript
beforeEach(() => {
  vi.clearAllMocks();
});
```

## Resources

- [Testing Patterns](./TESTING_PATTERNS.md) - Common testing patterns
- [Test Strategy](./TEST_STRATEGY.md) - Overall testing strategy
- [Vitest Mocking](https://vitest.dev/guide/mocking.html) - Vitest mocking documentation

