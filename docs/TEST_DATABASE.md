# Test Database Integration Guide

**Date**: 2025-12-25  
**Status**: ✅ Implemented

## Overview

Test database integration allows you to write tests that use a real database instead of mocks. This catches more integration issues but requires careful setup to ensure test isolation.

## Features

- ✅ **Transaction-based isolation** - Each test runs in a transaction that's rolled back
- ✅ **Database fixtures** - Pre-defined test data using factories
- ✅ **Automatic cleanup** - No manual cleanup needed with transactions
- ✅ **Migration testing** - Verify migrations work correctly
- ✅ **Seeding utilities** - Seed test database with data

## Quick Start

### 1. Configure Test Database

Set `TEST_DATABASE_URL` in your `.env` file:

```env
# Use a separate test database (recommended)
TEST_DATABASE_URL=postgresql://user:password@localhost:5432/smartflow_test
```

### 2. Run Migrations

```bash
# Run migrations on test database
TEST_DATABASE_URL=postgresql://... npx prisma migrate deploy
```

### 3. Write Database Tests

```typescript
import { withDatabase } from "~/tests/database/database-test-helpers";

it("should create a user", async () => {
  await withDatabase(async (prisma) => {
    const user = await prisma.user.create({
      data: { npub: "npub-test", isEnabled: true },
    });
    expect(user).toBeDefined();
    // Transaction automatically rolled back!
  });
});
```

## Architecture

### Transaction-Based Isolation

Each test runs in a database transaction:

1. **Start Transaction** - Begin a new transaction
2. **Run Test** - Execute test code
3. **Rollback** - Automatically rollback transaction
4. **Clean State** - Database returns to original state

**Benefits:**
- No cleanup needed
- Test isolation
- Fast execution
- Safe (can't leave test data)

### Test Database Client

The test database client is separate from the production client:

```typescript
import { getTestPrisma } from "~/tests/database/test-db";

const prisma = getTestPrisma();
// Uses TEST_DATABASE_URL or DATABASE_URL
```

## Usage Patterns

### Basic Database Test

```typescript
import { withDatabase } from "~/tests/database/database-test-helpers";

it("should create and retrieve user", async () => {
  await withDatabase(async (prisma) => {
    const user = await prisma.user.create({
      data: { npub: "npub-test", isEnabled: true },
    });

    const retrieved = await prisma.user.findUnique({
      where: { id: user.id },
    });

    expect(retrieved).toBeDefined();
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

### Testing Model Functions

```typescript
import { withDatabase } from "~/tests/database/database-test-helpers";
import { createPost, getUserById } from "~/models/post.server";

it("should create post using model function", async () => {
  await withDatabase(async (prisma) => {
    const user = await prisma.user.create({
      data: { npub: "npub-test", isEnabled: true },
    });

    const post = await createPost({
      userId: user.id,
      content: "Test post",
    });

    expect(post).toBeDefined();
  });
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
import { userFactory, postFactory } from "~/tests/factories";

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

Always use `withDatabase` with transactions:

```typescript
// Good - automatic cleanup
await withDatabase(async (prisma) => {
  // Test code
});

// Avoid - requires manual cleanup
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
```

### 3. Test Behavior, Not Implementation

Focus on what functions do:

```typescript
// Good
const user = await getUserById("user-123");
expect(user).toBeDefined();

// Less ideal
expect(prisma.user.findUnique).toHaveBeenCalled();
```

### 4. Keep Tests Fast

Database tests are slower - use them judiciously:

- Use mocks for unit tests
- Use database for integration tests
- Use database for complex relationships

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

## Configuration

### Environment Variables

```env
# Test database URL (separate from production)
TEST_DATABASE_URL=postgresql://user:password@localhost:5432/smartflow_test

# Or use same database (not recommended)
TEST_DATABASE_URL=${DATABASE_URL}
```

### Database Setup

```bash
# Create test database
createdb smartflow_test

# Run migrations
TEST_DATABASE_URL=postgresql://... npx prisma migrate deploy

# Or use setup utility
npm run test:db:setup
```

## Troubleshooting

### "TEST_DATABASE_URL not set"

Set `TEST_DATABASE_URL` in your `.env` file.

### "Connection refused"

Ensure PostgreSQL is running:
```bash
npm run docker  # If using Docker
# or
pg_ctl start    # If using local PostgreSQL
```

### "Migration failed"

Run migrations manually:
```bash
TEST_DATABASE_URL=postgresql://... npx prisma migrate deploy
```

### "Transaction timeout"

Increase transaction timeout or simplify test.

### Tests Affecting Each Other

Ensure you're using transactions:
```typescript
await withDatabase(async (prisma) => {
  // Test code - automatically isolated
});
```

## CI/CD Integration

### GitHub Actions

```yaml
- name: Setup test database
  run: |
    createdb smartflow_test
    TEST_DATABASE_URL=postgresql://... npx prisma migrate deploy

- name: Run database tests
  run: npm run test:db
  env:
    TEST_DATABASE_URL: postgresql://...
```

## Resources

- [Test Database README](../tests/database/README.md) - Detailed usage guide
- [Testing Patterns](./TESTING_PATTERNS.md) - Common testing patterns
- [Prisma Testing Guide](https://www.prisma.io/docs/guides/testing) - Prisma best practices


