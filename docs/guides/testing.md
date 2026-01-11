# Testing Guide

**Estimated time:** 45 minutes  
**Difficulty:** Intermediate  
**Last updated:** 2026-01-03  
**Note**: Test structure updated - large test files split into scenario-driven files (see
[Test Suite Refactoring](../test-suite-refactoring-complete.md))

Comprehensive guide to testing in SmartFlowSocial, covering strategy, patterns, and best practices.

---

## Table of Contents

- [Testing Philosophy](#testing-philosophy)
- [Test Types](#test-types)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Testing Patterns](#testing-patterns)
- [Coverage Strategy](#coverage-strategy)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Testing Philosophy

### Test Pyramid

We follow the **test pyramid** principle:

```
        /\
       /  \      E2E Tests (Cypress)
      /    \     - ~40% of user flows
     /      \    - Full browser interactions
    /--------\
   /          \  Integration Tests (Vitest)
  /            \ - ~70% of loaders, 100% of action handlers
 /              \ - ~90% of API routes, ~70% of model functions
/----------------\
                  Unit Tests (Vitest)
                  - ~40% of business logic
                  - Fast, isolated tests
```

**Principle**: More unit tests, fewer integration tests, even fewer E2E tests.

### Testing Principles

- **Fast Feedback**: Unit tests run in milliseconds
- **Isolation**: Tests don't depend on external services
- **Repeatability**: Tests produce consistent results
- **Maintainability**: Tests are easy to understand and update
- **Coverage**: Aim for 70-80% overall coverage
- **Quality over Quantity**: Focus on meaningful tests

---

## Test Types

SmartFlowSocial uses multiple testing frameworks and techniques:

| Type                     | Description                                     | Location                      | Framework           | Speed    |
| ------------------------ | ----------------------------------------------- | ----------------------------- | ------------------- | -------- |
| **Unit Tests**           | Pure function tests for critical business logic | `tests/unit/*.test.ts`        | Vitest              | < 100ms  |
| **Integration Tests**    | Loader/API/Model tests that verify data flow    | `tests/integration/*.test.ts` | Vitest              | < 1s     |
| **Property-Based Tests** | Random input generation to find edge cases      | `tests/property/*.test.ts`    | Vitest + fast-check | 1-5s     |
| **Security Tests**       | XSS, SQL injection, authentication, etc.        | `tests/security/*.test.ts`    | Vitest              | < 1s     |
| **Performance Tests**    | Function performance benchmarks                 | `tests/performance/*.test.ts` | Vitest + k6         | Variable |
| **E2E Tests**            | Full user flow tests (login, navigation, forms) | `tests/e2e/**/*.cy.ts`        | Cypress             | 5-30s    |

### When to Use Each

#### Unit Tests (Vitest)

**When to Use:**

- Pure functions (no side effects)
- Business logic calculations
- Data transformations
- Utility functions

**Examples:**

- Scheduling algorithms
- Date formatting
- String manipulation
- Validation logic

#### Integration Tests (Vitest)

**When to Use:**

- Remix loaders and actions
- API routes
- Database operations (via mocked Prisma)
- Service layer functions
- Queue workers

**Examples:**

- Dashboard loader
- Post creation action
- API endpoint handlers
- Model CRUD operations

#### Property-Based Tests

**When to Use:**

- Functions with many possible inputs
- Edge case discovery
- Round-trip conversions
- Mathematical operations

**Examples:**

- Date formatting with random dates
- URL parsing with random strings
- Key conversions (npub ↔ hex)
- Scheduling with random intervals

#### Security Tests

**When to Use:**

- Input sanitization
- Authentication/authorization
- SQL injection prevention
- XSS prevention
- File upload validation

**Examples:**

- Markdown sanitization
- Session management
- Parameterized queries
- File type validation

#### Performance Tests

**When to Use:**

- Critical performance paths
- Load testing
- Benchmarking
- Performance regression detection

**Examples:**

- Content combining with large arrays
- Statistics fetching with many IDs
- API endpoint load tests
- Loader performance tests

#### E2E Tests (Cypress)

**When to Use:**

- Critical user flows
- Browser-specific behavior
- Full integration scenarios
- UI interactions

**Examples:**

- User authentication flow
- Post creation flow
- Dashboard navigation
- Settings updates

### Why Vitest for Unit/Integration Tests?

**Benefits:**

1. **Speed**: Runs in Node.js without browser overhead (10-100x faster)
2. **No Server Required**: Unit/integration tests don't need a running dev server
3. **Better Developer Experience**: Fast feedback, watch mode, better error messages
4. **Direct Function Testing**: Test functions directly without HTTP requests
5. **Better Mocking**: Native support for mocking with `vi.mock()`

---

## Running Tests

### Prerequisites

1. **Node.js 20+** installed
2. **Dependencies installed**: Run `pnpm install`
3. **Database running**: Ensure PostgreSQL is accessible (via Docker or local install)
4. **Environment configured**: Copy `example.env` to `.env` and configure required variables
5. **k6 installed** (optional, for load tests)

### All Test Suites

```bash
# Run all Vitest tests (unit, integration, property, security, performance)
pnpm test

# Run all tests with coverage
pnpm test:coverage

# Run all tests and show Cypress instructions
pnpm test:all
```

### Vitest Tests (Unit & Integration)

```bash
# Run all Vitest tests once
pnpm test

# Run tests in watch mode (recommended for development)
pnpm test:watch

# Run tests with UI
pnpm test:ui

# Run tests with coverage report
pnpm test:coverage

# Run only unit tests
pnpm test:unit

# Run only integration tests
pnpm test:integration

# Run property-based tests
pnpm test:property

# Run security tests
pnpm test:security

# Run performance tests
pnpm test:performance
```

### Cypress Tests (E2E)

> [!IMPORTANT] The development server **must be running** before executing Cypress tests. Tests run
> against `http://localhost:3000` by default.

```bash
# Terminal 1: Start the dev server
pnpm dev

# Terminal 2: Run Cypress tests
pnpm test:e2e

# Open Cypress UI for interactive testing
pnpm test:e2e:open
```

### Running Specific Tests

```bash
# Vitest - Run a single test file
pnpm test -- tests/unit/scheduling-logic.test.ts

# Vitest - Run tests matching a pattern
pnpm test -- --grep "dashboard"

# Cypress - Run a single test file
pnpm exec cypress run --spec "tests/e2e/smoke.cy.ts"
```

---

## Writing Tests

### Project Structure

```
tests/
├── setup.ts                 # Vitest configuration
├── unit/                    # Unit tests
│   ├── scheduling-logic.test.ts
│   ├── engagement-logic.test.ts
│   └── error-classes.test.ts
├── integration/             # Integration tests
│   ├── dashboard-loader.test.ts
│   ├── api-*.test.ts
│   ├── post-model.test.ts
│   ├── payments/            # Payment tests (scenario-driven)
│   │   ├── create-plan-invoice.test.ts
│   │   ├── check-payment-status.test.ts
│   │   ├── get-user-subscription.test.ts
│   │   ├── get-plans.test.ts
│   │   ├── update-user-subscription.test.ts
│   │   ├── handle-payment-completed.test.ts
│   │   ├── handle-payment-timeout.test.ts
│   │   └── create-renewal-payment.test.ts
│   └── longform-actions/    # Longform action tests (scenario-driven)
│       ├── shared-setup.ts
│       ├── image-upload.test.ts
│       ├── save-draft.test.ts
│       ├── publish.test.ts
│       ├── schedule.test.ts
│       └── hashtag-preset.test.ts
├── property/                # Property-based tests
├── security/                # Security tests
├── performance/             # Performance tests
├── factories/               # Test data factories
└── utils/                   # Test utilities
    ├── payment-test-helpers.ts    # Payment test helpers
    ├── action-test-helpers.ts     # Action handler helpers
    ├── integration-test-setup.ts  # Integration test setup
    └── test-scenario-builders.ts  # Scenario builders

tests/e2e/                   # Cypress E2E tests
├── smoke.cy.ts
├── dashboard.cy.ts
└── posts/
```

### Unit Test Example

```typescript
import { describe, it, expect } from "vitest";
import { formatScheduleTimeForInput } from "~/lib/schedule-formatting";

describe("Scheduling Logic", () => {
  it("should format UTC date correctly", () => {
    const testDate = new Date(Date.UTC(2024, 2, 15, 14, 30, 0));
    const result = formatScheduleTimeForInput(testDate, "UTC");
    expect(result).toBe("2024-03-15T14:30");
  });
});
```

### Integration Test Example

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader } from "~/routes/dashboard._index";

vi.mock("~/features/auth", () => ({
  requireUserId: vi.fn().mockResolvedValue("user-123"),
}));

vi.mock("~/features/posts", () => ({
  loadDashboardData: vi.fn().mockResolvedValue({ posts: [] }),
}));

describe("Dashboard Loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load dashboard data", async () => {
    const request = new Request("http://localhost:3000/dashboard");
    const response = await loader({ request, params: {}, context: {} });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("posts");
  });
});
```

### Property-Based Test Example

```typescript
import { fc, test } from "@fast-check/vitest";
import { formatDate } from "~/lib/helpers";

test.prop([fc.date()])("formatDate handles all dates", (date) => {
  const result = formatDate(date);
  expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
});
```

### Test Organization Best Practices

**Scenario-Driven Test Files**: Large test files are split into scenario-driven files for better
maintainability.

**Example**: Payment tests are organized by function:

- `payments/create-plan-invoice.test.ts` - Tests invoice creation
- `payments/check-payment-status.test.ts` - Tests status checking
- `payments/update-user-subscription.test.ts` - Tests subscription updates

**Shared Test Helpers**: Use shared helpers to reduce duplication:

```typescript
// Payment tests use payment-test-helpers.ts
import {
  createMockPaymentPrisma,
  createMockPlan,
  createMockPayment,
  setupPaymentTestEnvironment,
} from "~/tests/utils/payment-test-helpers";

// Action handler tests use action-test-helpers.ts
import { buildActionHandlerScenario } from "~/tests/utils/test-scenario-builders";
```

**Integration Test Setup**: Use shared setup helpers:

```typescript
import { setupIntegrationTest, cleanupIntegrationTest } from "~/tests/utils/test-helpers";

describe("My Integration Test", () => {
  const { userId } = setupIntegrationTest();

  afterEach(async () => {
    await cleanupIntegrationTest(userId);
  });

  // Your tests here
});
```

See [Test Suite Refactoring](../test-suite-refactoring-complete.md) for details on the refactoring.

### Test Data Factories

Use test data factories for consistent test data:

```typescript
import { postFactory, userFactory } from "~/tests/factories";

// Simple usage
const post = postFactory.draft();
const user = userFactory.basic();

// Builder pattern
const post = new PostFactory()
  .withCaption("My post")
  .withImages(["https://example.com/image.jpg"])
  .withQueueType("queue-123")
  .asScheduled("1704067200")
  .build();
```

See [Test Factories README](../tests/factories/README.md) for details.

---

## Testing Patterns

### Mocking Patterns

#### When to Mock

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

#### Prisma Mocking

```typescript
import { vi } from "vitest";

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  },
  post: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
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

#### External API Mocking

```typescript
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
  });
});
```

#### Mocking Best Practices

1. **Mock Before Imports**: Place mocks before imports
2. **Clear Mocks in beforeEach**: Clear mocks between tests
3. **Use Type-Safe Mocks**: Type mocks correctly
4. **Mock Return Values Match Types**: Ensure mock return values match expected types
5. **Use Partial Mocks When Appropriate**: Mock only what you need

### Test Structure Patterns

#### Arrange-Act-Assert

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

#### Error Testing

```typescript
import { ValidationError } from "~/lib/errors";

it("should throw ValidationError for invalid input", async () => {
  await expect(loader({ request, params: {}, context: {} })).rejects.toThrow(ValidationError);
});
```

### Anti-Patterns to Avoid

1. **Testing Implementation Details**: Test behavior, not implementation
2. **Shared Test State**: Each test should be independent
3. **Over-Mocking**: Only mock external dependencies
4. **Mocking What You're Testing**: Don't mock the function under test
5. **Not Clearing Mocks**: Clear mocks between tests

---

## Coverage Strategy

### Coverage Goals

#### Overall Coverage

- **Current**: 70-75%
- **Target**: 80%
- **Critical Paths**: 95%+

#### By Test Type

| Test Type         | Current     | Target        | Status         |
| ----------------- | ----------- | ------------- | -------------- |
| Unit Tests        | 40%         | 60-70%        | 🟡 In Progress |
| Integration Tests | 70%         | 80-90%        | 🟢 Good        |
| E2E Tests         | 40%         | 50-60%        | 🟡 In Progress |
| Property-Based    | 3 functions | 10+ functions | 🟡 In Progress |
| Security Tests    | 7 areas     | 7 areas       | ✅ Complete    |
| Performance Tests | 3 areas     | 5+ areas      | 🟡 In Progress |

### Coverage Thresholds

Coverage thresholds are enforced in CI/CD and `vitest.config.ts`:

| Metric         | Threshold | Rationale                           |
| -------------- | --------- | ----------------------------------- |
| **Lines**      | 70%       | Ensures most code paths are tested  |
| **Functions**  | 65%       | Ensures most functions have tests   |
| **Branches**   | 60%       | Ensures conditional logic is tested |
| **Statements** | 70%       | Ensures most statements execute     |

### Coverage Goals by Area

#### Critical Paths (95%+)

- Authentication/authorization
- Payment processing
- Post publishing
- Queue scheduling
- Error handling

#### High Priority (80-90%)

- API routes
- Action handlers
- Loaders
- Model functions
- Business logic services

#### Medium Priority (70-80%)

- Utility functions
- Helper functions
- Data transformations
- Formatting functions

### What NOT to Test

**Excluded from Coverage:**

- Third-party library code
- Framework code (Remix, Prisma)
- Generated code
- Simple pass-through functions
- Configuration constants
- Test files themselves
- Build artifacts
- Type definitions (`*.d.ts`)

### Coverage Reporting

```bash
# Generate coverage report
pnpm test:coverage

# View HTML report
open coverage/index.html

# Coverage with thresholds check
pnpm test:coverage:report

# View coverage trend
pnpm test:coverage:trend
```

---

## Best Practices

### Test Quality Checklist

- [ ] Tests are isolated (no shared state)
- [ ] Tests are deterministic (same input = same output)
- [ ] Tests are fast (< 1s for unit, < 5s for integration)
- [ ] Tests are readable (clear names, good structure)
- [ ] Tests are maintainable (use factories, avoid duplication)
- [ ] Tests cover edge cases
- [ ] Tests verify both success and failure paths

### Code Quality in Tests

- Use TypeScript for type safety
- Use factories for test data
- Use descriptive test names
- Group related tests with `describe` blocks
- Clean up after tests (`afterEach`, `afterAll`)
- Mock external dependencies
- Avoid test interdependencies

### Testing Workflow

1. **Write Code**: Implement feature
2. **Write Tests**: Write tests alongside code
3. **Run Tests**: `pnpm test:watch`
4. **Refactor**: Improve code and tests
5. **Commit**: Commit with tests passing

### Pre-Commit Checklist

- [ ] All tests pass locally
- [ ] Coverage thresholds met
- [ ] No new linting errors
- [ ] Tests are readable and maintainable
- [ ] Test names are descriptive

---

## Troubleshooting

### "Connection refused" errors

Ensure the dev server is running:

```bash
pnpm dev
```

### Tests timing out

1. Check if the app is accessible at `http://localhost:3000`
2. Increase timeout in `cypress.config.ts` if needed
3. Use `cy.visitAndCheck()` instead of `cy.visit()` for more reliable navigation

### Database-related failures

1. Ensure PostgreSQL is running: `pnpm docker` (if using Docker)
2. Check `.env` has correct `DATABASE_URL`
3. Run migrations: `pnpm exec prisma migrate deploy`

### Coverage threshold failures

1. Review coverage report: `pnpm test:coverage`
2. Add missing tests
3. Adjust thresholds if needed (in `vitest.config.ts`)

### Mock-related issues

1. Ensure mocks are set up before imports
2. Clear mocks in `beforeEach` hooks
3. Check mock return values match expected types

---

## Configuration

### Vitest Configuration

Configuration is in `vitest.config.ts`:

- **Test environment**: Node.js (for server-side tests)
- **Setup file**: `tests/setup.ts` (runs before all tests)
- **Coverage**: Uses V8 provider with thresholds
- **Path aliases**: Supports `~/*` imports
- **Reporters**: Default, JUnit XML, JSON

### Cypress Configuration

Configuration is in `cypress.config.ts`:

- **Base URL**: Defaults to `http://localhost:3000` (or port from `PORT` env var)
- **CI Mode**: Uses port `8811` when `CI=true`
- **Screenshots**: Disabled in CI, enabled locally on failure

---

## Related Documentation

- [Developer Guide](./developer-guide.md) - Development workflow
- [Code Examples](../examples/code-samples.md) - Code examples including testing
- [Architecture Overview](../getting-started/architecture.md) - System design

---

**Next:** [Developer Guide](./developer-guide.md) → Development workflow
