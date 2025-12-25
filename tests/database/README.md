# Test Database Integration

This directory contains utilities for integrating real database tests with transaction-based isolation.

## Overview

Test database integration allows you to write tests that use a real database instead of mocks. This catches more integration issues but requires careful setup to ensure test isolation.

## Features

- ✅ **Transaction-based isolation** - Each test runs in a transaction that's rolled back
- ✅ **Database fixtures** - Pre-defined test data
- ✅ **Automatic cleanup** - No manual cleanup needed with transactions
- ✅ **Migration testing** - Verify migrations work correctly
- ✅ **Seeding utilities** - Seed test database with data

## Setup

### 1. Configure Test Database

Set `TEST_DATABASE_URL` in your `.env` file:

```env
# Use a separate test database
TEST_DATABASE_URL=postgresql://user:password@localhost:5432/smartflow_test

# Or use the same database (not recommended for CI)
TEST_DATABASE_URL=${DATABASE_URL}
```

### 2. Run Migrations

Before running database tests, ensure migrations are up to date:

```bash
# Run migrations on test database
TEST_DATABASE_URL=postgresql://... npx prisma migrate deploy
```

Or use the setup utility:

```typescript
import { setupTestDatabase } from "~/tests/database/test-db";

beforeAll(async () => {
  await setupTestDatabase();
});
```

## Usage

### Basic Usage with Transactions

```typescript
import { describe, it, expect } from "vitest";
import { withDatabase } from "~/tests/database/database-test-helpers";

describe("User Model", () => {
  it("should create a user", async () => {
    await withDatabase(async (prisma) => {
      const user = await prisma.user.create({
        data: {
          npub: "npub-test-123",
          isEnabled: true,
        },
      });

      expect(user).toBeDefined();
      // Transaction automatically rolled back - no cleanup needed!
    });
  });
});
```

### Using Fixtures

```typescript
import { withDatabase, fixtures } from "~/tests/database/database-test-helpers";

it("should get user with queues", async () => {
  const testFixtures = fixtures.userWithQueues();
  
  await withDatabase(async (prisma) => {
    const user = await prisma.user.findUnique({
      where: { id: testFixtures.users![0].id },
      include: { queueTypes: true },
    });

    expect(user?.queueTypes).toHaveLength(2);
  }, testFixtures);
});
```

### Using describeDatabase Helper

```typescript
import { describeDatabase, withDatabase } from "~/tests/database/database-test-helpers";

describeDatabase("Post Model", () => {
  it("should create a post", async () => {
    await withDatabase(async (prisma) => {
      // Test code
    });
  });
});
```

### Testing Model Functions

```typescript
import { withDatabase } from "~/tests/database/database-test-helpers";
import { createPost, getUserById } from "~/models/post.server";

it("should create post using model function", async () => {
  await withDatabase(async (prisma) => {
    // Create user first
    const user = await prisma.user.create({
      data: { npub: "npub-test", isEnabled: true },
    });

    // Use model function
    const post = await createPost({
      userId: user.id,
      content: "Test post",
    });

    expect(post).toBeDefined();
  });
});
```

## Transaction Isolation

### How It Works

Each test runs in a database transaction:

1. **Start Transaction** - Begin a new transaction
2. **Run Test** - Execute test code
3. **Rollback** - Automatically rollback transaction
4. **Clean State** - Database returns to original state

### Benefits

- ✅ **No cleanup needed** - Transactions handle cleanup automatically
- ✅ **Test isolation** - Tests don't affect each other
- ✅ **Fast** - Rollback is faster than deleting data
- ✅ **Safe** - Can't accidentally leave test data

### Limitations

- ⚠️ **Transaction behavior** - Can't test transaction behavior itself
- ⚠️ **Concurrent tests** - May have issues with parallel test execution
- ⚠️ **Database locks** - Some operations may lock tables

## Fixtures

### Available Fixtures

```typescript
import { fixtures } from "~/tests/database/database-test-helpers";

// Single user
fixtures.singleUser()

// User with queue types
fixtures.userWithQueues()

// User with posts
fixtures.userWithPosts()

// User with scheduled posts
fixtures.userWithScheduledPosts()

// User with hashtag presets
fixtures.userWithHashtagPresets()

// User with payments
fixtures.userWithPayments()
```

### Creating Custom Fixtures

```typescript
import { createMinimalFixtures, createCompleteFixtures } from "~/tests/database/database-test-helpers";

const customFixtures = {
  users: [userFactory.basic({ id: "custom-user" })],
  posts: [postFactory.draft({ userId: "custom-user" })],
};

await withDatabase(async (prisma) => {
  // Use custom fixtures
}, customFixtures);
```

## Migration Testing

Test that migrations work correctly:

```typescript
import { describe, it, expect } from "vitest";
import { setupTestDatabase } from "~/tests/database/test-db";

describe("Migrations", () => {
  it("should run migrations successfully", async () => {
    await setupTestDatabase();
    // Migrations should complete without errors
  });
});
```

## Best Practices

### 1. Use Transactions for Isolation

Always use `withDatabase` with transactions for test isolation:

```typescript
// Good
await withDatabase(async (prisma) => {
  // Test code
});

// Avoid (requires manual cleanup)
const prisma = getTestPrisma();
// ... test code ...
await prisma.user.deleteMany({});
```

### 2. Use Fixtures for Test Data

Use fixtures instead of manually creating data:

```typescript
// Good
const fixtures = fixtures.userWithPosts();
await withDatabase(async (prisma) => {
  // Use fixtures
}, fixtures);

// Less ideal
await withDatabase(async (prisma) => {
  const user = await prisma.user.create({ ... });
  const post = await prisma.post.create({ ... });
  // ... test code ...
});
```

### 3. Test Behavior, Not Implementation

Focus on what functions do, not how they do it:

```typescript
// Good
const user = await getUserById("user-123");
expect(user).toBeDefined();

// Less ideal
expect(prisma.user.findUnique).toHaveBeenCalled();
```

### 4. Keep Tests Fast

Database tests are slower than mocks - use them judiciously:

- Use mocks for unit tests
- Use database for integration tests
- Use database for testing complex relationships

## Troubleshooting

### "TEST_DATABASE_URL not set"

Set `TEST_DATABASE_URL` in your `.env` file or environment.

### "Connection refused"

Ensure PostgreSQL is running and accessible.

### "Migration failed"

Run migrations manually:
```bash
TEST_DATABASE_URL=postgresql://... npx prisma migrate deploy
```

### "Transaction timeout"

Increase transaction timeout:
```typescript
await prisma.$transaction(async (tx) => {
  // Test code
}, { timeout: 60000 }); // 60 seconds
```

## When to Use Database Tests

### Use Database Tests For:

- ✅ Testing complex relationships
- ✅ Testing migrations
- ✅ Testing database constraints
- ✅ Integration testing
- ✅ Testing transaction behavior

### Use Mocks For:

- ✅ Unit tests
- ✅ Fast feedback
- ✅ Testing error handling
- ✅ Testing without database setup

## Resources

- [Test Strategy](../docs/TEST_STRATEGY.md) - Overall testing strategy
- [Testing Patterns](../docs/TESTING_PATTERNS.md) - Common testing patterns
- [Prisma Testing Guide](https://www.prisma.io/docs/guides/testing) - Prisma testing best practices

