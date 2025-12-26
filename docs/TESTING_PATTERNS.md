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
import { createActionFormData } from "~/tests/utils/test-helpers";
import { action } from "~/routes/dashboard._index";

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

### Prisma Mocking

**Pattern**: Mock Prisma client for database operations

```typescript
import { vi } from "vitest";

const mockPrisma = {
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

describe("Post Model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should get post by ID", async () => {
    mockPrisma.post.findUnique.mockResolvedValue({
      id: "post-123",
      userId: "user-123",
    });

    const post = await getPostById("post-123");
    expect(post).toBeDefined();
    expect(mockPrisma.post.findUnique).toHaveBeenCalledWith({
      where: { id: "post-123" },
    });
  });
});
```

### External API Mocking

**Pattern**: Mock external API calls

```typescript
import { vi } from "vitest";

global.fetch = vi.fn();

describe("getPostStats", () => {
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

## Resources

- [Mocking Guidelines](./MOCKING_GUIDELINES.md) - Detailed mocking strategies
- [Test Strategy](./TEST_STRATEGY.md) - Overall testing strategy
- [Test Troubleshooting](./TEST_TROUBLESHOOTING.md) - Common issues


