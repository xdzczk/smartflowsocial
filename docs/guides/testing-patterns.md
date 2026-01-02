# Testing Patterns Guide

**Date**: 2025-12-25  
**Status**: Comprehensive patterns documented

This guide covers common testing patterns used in SmartFlowSocial.

## Table of Contents

1. [Unit Test Patterns](#unit-test-patterns)
2. [Integration Test Patterns](#integration-test-patterns)
3. [Mocking Patterns](#mocking-patterns)
4. [Test Data Patterns](#test-data-patterns)
5. [Assertion Patterns](#assertion-patterns)
6. [Error Testing Patterns](#error-testing-patterns)

## Unit Test Patterns

### Pure Function Testing

**Pattern**: Test pure functions with various inputs

```typescript
import { describe, it, expect } from "vitest";

import { formatDate } from "~/lib/helpers";

describe("formatDate", () => {
  it("should format valid dates", () => {
    const date = new Date("2024-01-15");
    expect(formatDate(date)).toBe("01/15/2024");
  });

  it("should handle edge cases", () => {
    const date = new Date("1970-01-01");
    expect(formatDate(date)).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });
});
```

### Boundary Testing

**Pattern**: Test boundary conditions

```typescript
describe("getTimeRemaining", () => {
  it("should handle past dates", () => {
    const past = new Date(Date.now() - 1000);
    const result = getTimeRemaining(past);
    expect(result).toBe("0 seconds");
  });

  it("should handle future dates", () => {
    const future = new Date(Date.now() + 3600000);
    const result = getTimeRemaining(future);
    expect(result).toContain("hour");
  });
});
```

### Property-Based Testing

**Pattern**: Use property-based tests for functions with many inputs

```typescript
// eslint-disable-next-line import/no-unresolved
import { fc, test } from "@fast-check/vitest";

import { formatDate } from "~/lib/helpers";

test.prop([fc.date()])("formatDate handles all dates", (date) => {
  const result = formatDate(date);
  expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
});
```

## Integration Test Patterns

### Loader Testing

**Pattern**: Test Remix loaders with mocked dependencies

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

import { loader } from "~/routes/dashboard._index";

vi.mock("~/features/auth/session.server", () => ({
  requireUserId: vi.fn().mockResolvedValue("user-123"),
}));

vi.mock("~/models/post.server", () => ({
  getScheduledPosts: vi.fn().mockResolvedValue([]),
}));

describe("Dashboard Loader", () => {
  it("should load dashboard data", async () => {
    const request = new Request("http://localhost:3000/dashboard");
    const response = await loader({ request, params: {}, context: {} });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("posts");
  });
});
```

### Action Handler Testing

**Pattern**: Test action handlers with FormData

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

import { action } from "~/routes/dashboard._index";
import { createActionFormData } from "~/tests/utils/test-helpers";

describe("Dashboard Action", () => {
  it("should handle post deletion", async () => {
    const formData = createActionFormData("delete", {
      postId: "post-123",
    });

    const request = new Request("http://localhost:3000/dashboard", {
      method: "POST",
      body: formData,
    });

    const response = await action({ request, params: {}, context: {} });
    expect(response.status).toBe(200);
  });
});
```

### API Route Testing

**Pattern**: Test API routes with query parameters

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

import { loader } from "~/routes/api.effective-hashtags";

describe("Effective Hashtags API", () => {
  it("should return hashtags for queue", async () => {
    const url = new URL("http://localhost:3000/api/effective-hashtags");
    url.searchParams.set("queueTypeId", "queue-123");

    const request = new Request(url.toString());
    const response = await loader({ request, params: {}, context: {} });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("hashtags");
  });
});
```

## Mocking Patterns

### When to Mock

**Always Mock:**
- Database (Prisma)
- External APIs (fetch, HTTP clients)
- File system operations
- Environment variables
- Third-party services

**Don't Mock:**
- Functions you're testing
- Pure utility functions
- Business logic functions
- Type definitions

### Prisma Mocking

**Pattern**: Mock Prisma client for database operations

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

**Prisma Relations Mock**:

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

**Prisma Transaction Mock**:

```typescript
const mockPrisma = {
  $transaction: vi.fn(async (callback) => {
    return callback(mockPrisma);
  }),
};
```

### External API Mocking

**Pattern**: Mock external API calls

```typescript
import { vi } from "vitest";

global.fetch = vi.fn();

describe("getPostStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch stats from external API", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        "event-123": { replies: 5, reposts: 2, likes: 10 },
      }),
    });

    const stats = await getPostStats(["event-123"]);
    expect(stats).toHaveProperty("event-123");
    expect(global.fetch).toHaveBeenCalled();
  });
});
```

**HTTP Client Mock**:

```typescript
vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));
```

### Remix Utilities Mocking

**Session Mock**:

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

**FormData Mock** (use real FormData):

```typescript
import { createActionFormData } from "~/tests/utils/test-helpers";

const formData = createActionFormData("create", {
  content: "Test content",
});
```

### File System Mocking

**File Upload Mock**:

```typescript
vi.mock("~/features/upload/s3.server", () => ({
  createUploadHandler: vi.fn(() => async (file) => {
    return "https://example.com/uploaded-file.jpg";
  }),
  uploadBufferToS3: vi.fn().mockResolvedValue("https://example.com/file.jpg"),
}));
```

### Environment Variables Mocking

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

### Module Mocking

**Pattern**: Mock entire modules

```typescript
import { vi } from "vitest";

vi.mock("~/features/auth/session.server", () => ({
  requireUserId: vi.fn().mockResolvedValue("user-123"),
  getUser: vi.fn().mockResolvedValue({ id: "user-123" }),
}));
```

### Partial Mocking

**Pattern**: Mock specific functions while keeping others

```typescript
import { vi } from "vitest";

import * as authModule from "~/features/auth/session.server";

vi.spyOn(authModule, "requireUserId").mockResolvedValue("user-123");
```

## Test Data Patterns

### Using Factories

**Pattern**: Use test data factories for consistent test data

```typescript
import { postFactory, userFactory } from "~/tests/factories";

describe("Post Operations", () => {
  it("should create a post", async () => {
    const user = userFactory.basic();
    const post = postFactory.draft({ userId: user.id });

    // Use post in test
  });
});
```

### Builder Pattern

**Pattern**: Use builder pattern for complex test data

```typescript
import { PostFactory } from "~/tests/factories";

const post = new PostFactory()
  .withCaption("My post")
  .withImages(["https://example.com/image.jpg"])
  .withQueueType("queue-123")
  .asScheduled("1704067200")
  .build();
```

### Bulk Creation

**Pattern**: Create multiple test objects

```typescript
import { postFactory } from "~/tests/factories";

const posts = postFactory.many(10, { draft: true });
expect(posts).toHaveLength(10);
```

## Assertion Patterns

### Response Assertions

**Pattern**: Assert HTTP response properties

```typescript
const response = await loader({ request, params: {}, context: {} });
const data = await response.json();

expect(response.status).toBe(200);
expect(response.headers.get("Content-Type")).toContain("application/json");
expect(data).toHaveProperty("posts");
expect(Array.isArray(data.posts)).toBe(true);
```

### Error Assertions

**Pattern**: Assert error responses

```typescript
import { AuthenticationError } from "~/lib/errors";

it("should throw AuthenticationError for unauthenticated requests", async () => {
  await expect(loader({ request, params: {}, context: {} })).rejects.toThrow(
    AuthenticationError,
  );
});
```

### Data Structure Assertions

**Pattern**: Assert data structure and types

```typescript
expect(data).toMatchObject({
  id: expect.any(String),
  userId: expect.any(String),
  createdAt: expect.any(Date),
});
```

## Error Testing Patterns

### Error Class Testing

**Pattern**: Test custom error classes

```typescript
import { ValidationError, AuthenticationError } from "~/lib/errors";

describe("Error Classes", () => {
  it("should create ValidationError with correct properties", () => {
    const error = new ValidationError("Invalid input", { field: "email" });

    expect(error).toBeInstanceOf(ValidationError);
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe("Invalid input");
    expect(error.context).toEqual({ field: "email" });
  });
});
```

### Error Handling Testing

**Pattern**: Test error handling in functions

```typescript
it("should handle database errors gracefully", async () => {
  mockPrisma.post.findUnique.mockRejectedValue(new Error("Database error"));

  await expect(getPostById("post-123")).rejects.toThrow();
});
```

### Validation Error Testing

**Pattern**: Test input validation

```typescript
it("should reject invalid input", async () => {
  const formData = createActionFormData("create", {
    content: "", // Invalid: empty content
  });

  await expect(action({ request, params: {}, context: {} })).rejects.toThrow(
    ValidationError,
  );
});
```

## Mocking Best Practices

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

## Best Practices

### 1. Test Isolation

Each test should be independent:

```typescript
beforeEach(() => {
  vi.clearAllMocks();
});
```

### 2. Descriptive Test Names

Test names should clearly describe what they test:

```typescript
// Good
it("should return user by ID when user exists", () => { ... });

// Bad
it("should work", () => { ... });
```

### 3. Arrange-Act-Assert

Structure tests clearly:

```typescript
it("should calculate next schedule time", () => {
  // Arrange
  const queue = queueTypeFactory.interval(4);
  const now = new Date();

  // Act
  const result = calculateNextScheduleTime(queue, now);

  // Assert
  expect(result).toBeInstanceOf(Date);
  expect(result.getTime()).toBeGreaterThan(now.getTime());
});
```

### 4. One Assertion Per Test (When Possible)

Focus each test on one behavior:

```typescript
// Good
it("should return user ID", () => { ... });
it("should return undefined when not authenticated", () => { ... });

// Less ideal (but sometimes necessary)
it("should handle authentication", () => {
  // Multiple assertions for related behavior
});
```

### 5. Use Test Helpers

Extract common test logic into helpers:

```typescript
// tests/utils/test-helpers.ts
export function createActionFormData(action: string, data: Record<string, string>) {
  const formData = new FormData();
  formData.append("_action", action);
  // ... add data
  return formData;
}
```

## Anti-Patterns to Avoid

### 1. Testing Implementation Details

**Don't:**
```typescript
it("should call prisma.post.findUnique", () => {
  // Testing internal implementation
});
```

**Do:**
```typescript
it("should return post by ID", () => {
  // Testing behavior
});
```

### 2. Shared Test State

**Don't:**
```typescript
let sharedPost; // Shared state between tests

it("test 1", () => {
  sharedPost = createPost();
});

it("test 2", () => {
  // Depends on test 1
  expect(sharedPost).toBeDefined();
});
```

**Do:**
```typescript
it("test 1", () => {
  const post = createPost();
  // Test post
});

it("test 2", () => {
  const post = createPost();
  // Independent test
});
```

### 3. Over-Mocking

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
vi.mock("~/features/auth/session.server");
```

### 4. Mocking What You're Testing

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

### 5. Not Clearing Mocks

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

- [Test Strategy](./test-strategy.md) - Overall testing strategy
- [Test Troubleshooting](./test-troubleshooting.md) - Common issues




