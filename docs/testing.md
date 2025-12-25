# Testing Guide

**Last Updated**: 2025-12-25  
**Status**: Comprehensive testing suite with Vitest, Cypress, and advanced testing features

This guide covers how to run and write tests for SmartFlowSocial. The project uses **Vitest** for unit, integration, property-based, security, and performance tests, and **Cypress** for end-to-end tests.

## Test Types

SmartFlowSocial uses the following test types:

| Type | Description | Location | Framework |
|------|-------------|----------|-----------|
| **Unit Tests** | Pure function tests for critical business logic | `tests/unit/*.test.ts` | Vitest |
| **Integration Tests** | Loader/API/Model tests that verify data flow | `tests/integration/*.test.ts` | Vitest |
| **Property-Based Tests** | Random input generation to find edge cases | `tests/property/*.test.ts` | Vitest + fast-check |
| **Security Tests** | XSS, SQL injection, authentication, etc. | `tests/security/*.test.ts` | Vitest |
| **Performance Tests** | Function performance benchmarks | `tests/performance/*.test.ts` | Vitest + k6 |
| **E2E Tests** | Full user flow tests (login, navigation, forms) | `cypress/e2e/*.cy.ts` | Cypress |
| **Smoke Tests** | Quick sanity checks for critical paths | `cypress/e2e/smoke.cy.ts` | Cypress |

> [!NOTE]
> **Vitest** is used for fast unit, integration, property-based, security, and performance tests that don't require a browser. **Cypress** is used for E2E tests that need real browser interactions.

## Prerequisites

Before running tests, ensure you have:

1. **Node.js 20+** installed
2. **Dependencies installed**: Run `npm install`
3. **Database running**: Ensure PostgreSQL is accessible (via Docker or local install)
4. **Environment configured**: Copy `example.env` to `.env` and configure required variables
5. **k6 installed** (optional, for load tests): See [Performance Testing Guide](./PERFORMANCE_TESTING.md)

## Running Tests

### All Test Suites

```bash
# Run all Vitest tests (unit, integration, property, security, performance)
npm run test

# Run all tests with coverage
npm run test:coverage

# Run all tests and show Cypress instructions
npm run test:all
```

### Vitest Tests (Unit & Integration)

Vitest tests run **without** a development server and are much faster than Cypress tests.

```bash
# Run all Vitest tests once
npm run test

# Run tests in watch mode (recommended for development)
npm run test:watch

# Run tests with UI
npm run test:ui

# Run tests with coverage report
npm run test:coverage

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run property-based tests
npm run test:property

# Run security tests
npm run test:security

# Run performance tests
npm run test:performance
```

### Cypress Tests (E2E)

> [!IMPORTANT]
> The development server **must be running** before executing Cypress tests. Tests run against `http://localhost:3000` by default.

```bash
# Terminal 1: Start the dev server
npm run dev

# Terminal 2: Run Cypress tests
npm run test:e2e
```

### Available Test Commands

| Command | Description | Framework |
|---------|-------------|-----------|
| `npm run test` | Run all Vitest tests | Vitest |
| `npm run test:watch` | Run Vitest in watch mode | Vitest |
| `npm run test:ui` | Open Vitest UI for interactive testing | Vitest |
| `npm run test:coverage` | Generate coverage report | Vitest |
| `npm run test:coverage:report` | Generate coverage and record trend | Vitest |
| `npm run test:coverage:trend` | View coverage trend report | Vitest |
| `npm run test:unit` | Run unit tests only | Vitest |
| `npm run test:integration` | Run integration tests only | Vitest |
| `npm run test:property` | Run property-based tests | Vitest |
| `npm run test:security` | Run security tests | Vitest |
| `npm run test:performance` | Run performance tests | Vitest |
| `npm run test:e2e` | Run all Cypress E2E tests | Cypress |
| `npm run test:e2e:open` | Open Cypress UI for interactive testing | Cypress |
| `npm run test:e2e:dev` | Starts dev server and opens Cypress | Cypress |
| `npm run test:all` | Run Vitest tests + show Cypress instructions | Vitest |

### Running Specific Tests

```bash
# Vitest - Run a single test file
npm run test -- tests/unit/scheduling-logic.test.ts

# Vitest - Run tests matching a pattern
npm run test -- --grep "dashboard"

# Cypress - Run a single test file
npx cypress run --spec "cypress/e2e/smoke.cy.ts"

# Cypress - Run tests in a specific folder
npx cypress run --spec "cypress/e2e/posts/**/*.cy.ts"
```

---

## Test Structure

```
tests/                       # Vitest tests
├── setup.ts                 # Vitest setup file
├── unit/                    # Unit tests for pure functions
│   ├── scheduling-logic.test.ts
│   ├── engagement-logic.test.ts
│   ├── subscription-logic.test.ts
│   ├── error-classes.test.ts
│   ├── helpers.test.ts
│   ├── nostr-conversion.test.ts
│   ├── markdown-sanitizer.test.ts
│   ├── utils.test.ts
│   └── date-utils.test.ts
├── integration/             # Integration tests
│   ├── dashboard-loader.test.ts
│   ├── scheduled-loader.test.ts
│   ├── calendar-loader.test.ts
│   ├── drafts-loader.test.ts
│   ├── posted-loader.test.ts
│   ├── subscription-loader.test.ts
│   ├── dashboard-action.test.ts
│   ├── scheduled-action.test.ts
│   ├── drafts-action.test.ts
│   ├── newpost-action.test.ts
│   ├── plans-action.test.ts
│   ├── settings-action.test.ts
│   ├── scheduling-algorithms.test.ts
│   ├── stats-server.test.ts
│   ├── post-model.test.ts
│   ├── longformpost-model.test.ts
│   ├── payment-model.test.ts
│   ├── user-model.test.ts
│   ├── api-*.test.ts (9 API route tests)
│   ├── engagement-loader.test.ts
│   ├── giveaway-loader.test.ts
│   ├── templates-loader.test.ts
│   ├── search-loader.test.ts
│   ├── queue-workers.test.ts
│   ├── queue-operations.test.ts
│   └── queue-client.test.ts
├── property/                # Property-based tests
│   ├── helpers-property.test.ts
│   ├── nostr-conversion-property.test.ts
│   └── scheduling-property.test.ts
├── security/                # Security tests
│   ├── xss-prevention.test.ts
│   ├── sql-injection.test.ts
│   ├── authentication.test.ts
│   ├── csrf-protection.test.ts
│   ├── input-validation.test.ts
│   ├── file-upload-security.test.ts
│   └── security-headers.test.ts
├── performance/              # Performance tests
│   ├── unit-performance.test.ts
│   ├── api-endpoints.js (k6)
│   ├── bulk-operations.js (k6)
│   └── loader-performance.js (k6)
├── factories/                # Test data factories
│   ├── post.factory.ts
│   ├── longform-post.factory.ts
│   ├── user.factory.ts
│   ├── queue-type.factory.ts
│   ├── hashtag-preset.factory.ts
│   ├── payment.factory.ts
│   ├── template.factory.ts
│   ├── asset.factory.ts
│   └── index.ts
└── utils/                    # Test utilities
    └── test-helpers.ts

cypress/                     # Cypress E2E tests
├── e2e/                     # Test files organized by feature
│   ├── smoke.cy.ts
│   ├── dashboard.cy.ts
│   ├── nostr-auth.cy.ts
│   ├── engagement/
│   ├── loaders/
│   ├── posts/
│   ├── settings/
│   └── subscription/
├── fixtures/
├── memes_test_files/
└── support/
```

---

## Test Types in Detail

### Unit Tests

Unit tests exercise pure functions independently of the UI. They run **much faster** than Cypress tests and don't require a browser or development server.

**Location**: `tests/unit/*.test.ts`

**Coverage**: ~40% of business logic functions

**Examples**:
- Scheduling logic (`scheduling-logic.test.ts`)
- Engagement grouping (`engagement-logic.test.ts`)
- Subscription logic (`subscription-logic.test.ts`)
- Error handling (`error-classes.test.ts`)
- Utility functions (`helpers.test.ts`, `nostr-conversion.test.ts`, etc.)

### Integration Tests

Integration tests verify Remix loaders, action handlers, API routes, and model functions without requiring a browser.

**Location**: `tests/integration/*.test.ts`

**Coverage**: ~70% of loaders, ~100% of action handlers, ~90% of API routes, ~70% of model functions

**Examples**:
- Loader tests (`dashboard-loader.test.ts`, `scheduled-loader.test.ts`, etc.)
- Action handler tests (`dashboard-action.test.ts`, `newpost-action.test.ts`, etc.)
- API route tests (`api-effective-hashtags.test.ts`, `api-upload.test.ts`, etc.)
- Model tests (`post-model.test.ts`, `user-model.test.ts`, etc.)
- Queue worker tests (`queue-workers.test.ts`, `queue-operations.test.ts`, etc.)

### Property-Based Tests

Property-based tests use random input generation to find edge cases automatically.

**Location**: `tests/property/*.test.ts`

**Tools**: `fast-check`

**Examples**:
- Helper functions (`helpers-property.test.ts`)
- Nostr conversions (`nostr-conversion-property.test.ts`)
- Scheduling algorithms (`scheduling-property.test.ts`)

See [Property-Based Testing Guide](./PROPERTY_BASED_TESTING.md) for details.

### Security Tests

Security tests verify that the application is protected against common vulnerabilities.

**Location**: `tests/security/*.test.ts`

**Coverage**:
- XSS prevention
- SQL injection prevention
- Authentication/authorization
- CSRF protection
- Input validation
- File upload security
- Security headers

See [Security Testing Guide](./SECURITY_TESTING.md) for details.

### Performance Tests

Performance tests verify that functions meet performance benchmarks.

**Location**: `tests/performance/*.test.ts` (Vitest) and `tests/performance/*.js` (k6)

**Tools**: Vitest for unit performance, k6 for load tests

**Examples**:
- Unit performance tests (`unit-performance.test.ts`)
- API endpoint load tests (`api-endpoints.js`)
- Bulk operations load tests (`bulk-operations.js`)
- Loader performance tests (`loader-performance.js`)

See [Performance Testing Guide](./PERFORMANCE_TESTING.md) for details.

### E2E Tests (Cypress)

E2E tests verify full user flows in a real browser environment.

**Location**: `cypress/e2e/*.cy.ts`

**Coverage**: ~40% of user flows

**Examples**:
- Smoke tests (`smoke.cy.ts`)
- Dashboard tests (`dashboard.cy.ts`)
- Post creation tests (`posts/new-post.cy.ts`)
- Authentication tests (`nostr-auth.cy.ts`)

---

## Test Data Factories

Use test data factories to create consistent test data easily:

```typescript
import { postFactory, userFactory, queueTypeFactory } from "~/tests/factories";

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

## Writing Tests

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
import { getUserById } from "~/models/user.server";

vi.mock("~/lib/prisma.server", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

describe("User Model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should get user by ID", async () => {
    // Test implementation
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

See [Testing Patterns Guide](./TESTING_PATTERNS.md) for more examples.

---

## Configuration

### Vitest Configuration

Configuration is in `vitest.config.ts`:

- **Test environment**: Node.js (for server-side tests)
- **Setup file**: `tests/setup.ts` (runs before all tests)
- **Coverage**: Uses V8 provider with thresholds
- **Path aliases**: Supports `~/*` imports
- **Reporters**: Default, JUnit XML, JSON

### Coverage Thresholds

Coverage thresholds are enforced:

| Metric | Threshold |
|--------|-----------|
| Lines | 70% |
| Functions | 65% |
| Branches | 60% |
| Statements | 70% |

See [Coverage Reporting Guide](./COVERAGE_REPORTING.md) for details.

### Cypress Configuration

Configuration is in `cypress.config.ts`:

- **Base URL**: Defaults to `http://localhost:3000` (or port from `PORT` env var)
- **CI Mode**: Uses port `8811` when `CI=true`
- **Screenshots**: Disabled in CI, enabled locally on failure

---

## CI/CD Integration

All tests run automatically in CI/CD:

- **Lint & Type Check** - ESLint and TypeScript validation
- **Unit Tests** - Fast unit test suite
- **Integration Tests** - Integration test suite
- **Property-Based Tests** - Property-based test suite
- **Security Tests** - Security test suite
- **Performance Tests** - Performance test suite
- **Coverage Check** - Coverage threshold validation

See [CI/CD Guide](./CI_CD.md) for details.

---

## Documentation

- [Test Strategy](./TEST_STRATEGY.md) - Overall testing strategy and philosophy
- [Testing Patterns](./TESTING_PATTERNS.md) - Common testing patterns and examples
- [Mocking Guidelines](./MOCKING_GUIDELINES.md) - How to mock dependencies
- [Coverage Goals](./COVERAGE_GOALS.md) - Coverage targets and rationale
- [Test Troubleshooting](./TEST_TROUBLESHOOTING.md) - Common issues and solutions
- [Coverage Reporting](./COVERAGE_REPORTING.md) - Coverage tracking and reporting
- [Property-Based Testing](./PROPERTY_BASED_TESTING.md) - Property-based testing guide
- [Security Testing](./SECURITY_TESTING.md) - Security testing guide
- [Performance Testing](./PERFORMANCE_TESTING.md) - Performance testing guide
- [CI/CD Guide](./CI_CD.md) - CI/CD pipeline documentation

---

## Troubleshooting

### "Connection refused" errors

Ensure the dev server is running:

```bash
npm run dev
```

### Tests timing out

1. Check if the app is accessible at `http://localhost:3000`
2. Increase timeout in `cypress.config.ts` if needed
3. Use `cy.visitAndCheck()` instead of `cy.visit()` for more reliable navigation

### Database-related failures

1. Ensure PostgreSQL is running: `npm run docker` (if using Docker)
2. Check `.env` has correct `DATABASE_URL`
3. Run migrations: `npx prisma migrate deploy`

### Coverage threshold failures

1. Review coverage report: `npm run test:coverage`
2. Add missing tests
3. Adjust thresholds if needed (in `vitest.config.ts`)

### Mock-related issues

1. Ensure mocks are set up before imports
2. Clear mocks in `beforeEach` hooks
3. Check mock return values match expected types

See [Test Troubleshooting Guide](./TEST_TROUBLESHOOTING.md) for more solutions.

---

## Best Practices

1. **Use Factories**: Always use test data factories instead of manually creating objects
2. **Mock External Dependencies**: Mock Prisma, external APIs, and file system operations
3. **Test Behavior, Not Implementation**: Focus on what functions do, not how they do it
4. **Keep Tests Fast**: Unit tests should run in milliseconds
5. **Write Descriptive Test Names**: Test names should clearly describe what they test
6. **Use Property-Based Tests**: For functions with many possible inputs
7. **Maintain Coverage**: Keep coverage above thresholds
8. **Run Tests Locally**: Run tests before committing

See [Testing Patterns Guide](./TESTING_PATTERNS.md) for more best practices.

---

## Next Steps

- Read [Test Strategy](./TEST_STRATEGY.md) to understand testing philosophy
- Review [Testing Patterns](./TESTING_PATTERNS.md) for common patterns
- Check [Mocking Guidelines](./MOCKING_GUIDELINES.md) for mocking strategies
- See [Coverage Goals](./COVERAGE_GOALS.md) for coverage targets
