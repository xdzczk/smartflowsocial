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
| **E2E Tests** | Full user flow tests (login, navigation, forms) | `tests/e2e/**/*.cy.ts` | Cypress |
| **Smoke Tests** | Quick sanity checks for critical paths | `tests/e2e/smoke.cy.ts` | Cypress |

> [!NOTE]
> **Vitest** is used for fast unit, integration, property-based, security, and performance tests that don't require a browser. **Cypress** is used for E2E tests that need real browser interactions.

## Prerequisites

Before running tests, ensure you have:

1. **Node.js 20+** installed
2. **Dependencies installed**: Run `npm install`
3. **Database running**: Ensure PostgreSQL is accessible (via Docker or local install)
4. **Environment configured**: Copy `example.env` to `.env` and configure required variables
5. **k6 installed** (optional, for load tests): See [Performance Testing Guide](./PERFORMANCE_TESTING.md)

---

## Vitest Setup

### Quick Answer: Unit Tests AND Integration Tests

**Vitest should be used for BOTH unit tests AND integration tests.**

- ✅ **Unit Tests**: Pure functions, utilities, business logic (no browser needed)
- ✅ **Integration Tests**: Remix loaders, API routes, server-side logic (no browser needed)
- ❌ **E2E Tests**: Full browser flows, UI interactions (use Cypress)

### Why Vitest?

**Benefits Over Cypress for Unit/Integration Tests**:

1. **Speed**: Vitest runs tests in Node.js without browser overhead (10-100x faster)
2. **No Server Required**: Unit/integration tests don't need a running dev server
3. **Better Developer Experience**: Fast feedback, watch mode, better error messages
4. **Direct Function Testing**: Test functions directly without HTTP requests
5. **Better Mocking**: Native support for mocking with `vi.mock()`

### When to Use Each

| Test Type | Framework | Why |
|-----------|-----------|-----|
| Pure functions (utilities, business logic) | **Vitest** | Fast, no browser needed |
| Remix loaders/actions | **Vitest** | Test server logic directly |
| API routes | **Vitest** | Test without HTTP overhead |
| React components (isolated) | **Vitest** | Fast rendering with jsdom |
| Full user flows | **Cypress** | Real browser interactions |
| UI interactions | **Cypress** | Real DOM events |
| Cross-browser testing | **Cypress** | Multiple browser support |

### Installation

Vitest and related dependencies should already be installed. If not, run:

```bash
npm install --save-dev vitest @vitest/ui @vitest/coverage-v8 jsdom @testing-library/react @testing-library/jest-dom happy-dom
```

### Project Structure

```
tests/
├── setup.ts                 # Vitest configuration
├── unit/                    # Unit tests
│   ├── scheduling-logic.test.ts
│   ├── engagement-logic.test.ts
│   ├── subscription-logic.test.ts
│   └── error-classes.test.ts
└── integration/            # Integration tests
    └── example-loader.test.ts
```

### Configuration Files

**`vitest.config.ts`**:
- Configures test environment (Node.js)
- Sets up path aliases (`~/*`)
- Configures coverage reporting
- Excludes Cypress and build directories

**`tests/setup.ts`**:
- Extends Vitest with jest-dom matchers
- Sets up global test environment
- Configures mocks and cleanup

### Migration from Cypress

**Before (Cypress - Slow)**:
```typescript
// tests/e2e/unit/scheduling-logic.cy.ts
describe("Scheduling Logic", () => {
  it("should format UTC date", () => {
    const date = new Date(Date.UTC(2024, 2, 15, 14, 30, 0));
    const result = formatScheduleTimeForInput(date, "UTC");
    expect(result).to.equal("2024-03-15T14:30");
  });
});
```

**After (Vitest - Fast)**:
```typescript
// tests/unit/scheduling-logic.test.ts
import { describe, it, expect } from "vitest";

describe("Scheduling Logic", () => {
  it("should format UTC date", () => {
    const date = new Date(Date.UTC(2024, 2, 15, 14, 30, 0));
    const result = formatScheduleTimeForInput(date, "UTC");
    expect(result).toBe("2024-03-15T14:30");
  });
});
```

### Benefits Summary

- ⚡ **10-100x faster** than Cypress for unit/integration tests
- 🚀 **No server required** - tests run directly in Node.js
- 💻 **Better DX** - watch mode, UI, better error messages
- 🎯 **Focused testing** - test logic without browser overhead
- 📊 **Coverage reports** - built-in coverage support

---

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
npx cypress run --spec "tests/e2e/smoke.cy.ts"

# Cypress - Run tests in a specific folder
npx cypress run --spec "tests/e2e/posts/**/*.cy.ts"
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

tests/
└── e2e/                     # Cypress E2E tests
    ├── smoke.cy.ts
    ├── dashboard.cy.ts
    ├── nostr-auth.cy.ts
    ├── engagement/
    ├── loaders/
    ├── posts/
    ├── settings/
    ├── subscription/
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

See the [Performance Testing](#performance-testing) section above for details.

### E2E Tests (Cypress)

E2E tests verify full user flows in a real browser environment.

**Location**: `tests/e2e/**/*.cy.ts`

**Coverage**: ~40% of user flows

**Examples**:
- Smoke tests (`smoke.cy.ts`)
- Dashboard tests (`dashboard.cy.ts`)
- Post creation tests (`posts/new-post.cy.ts`)
- Authentication tests (`nostr-auth.cy.ts`)

---

## Vitest Setup

### Overview

Vitest is used for both unit tests and integration tests. It runs tests in Node.js without browser overhead, making it 10-100x faster than Cypress for these test types.

### When to Use Vitest

| Test Type | Framework | Why |
|-----------|-----------|-----|
| Pure functions (utilities, business logic) | **Vitest** | Fast, no browser needed |
| Remix loaders/actions | **Vitest** | Test server logic directly |
| API routes | **Vitest** | Test without HTTP overhead |
| React components (isolated) | **Vitest** | Fast rendering with jsdom |
| Full user flows | **Cypress** | Real browser interactions |
| UI interactions | **Cypress** | Real DOM events |

### Benefits

1. **Speed**: Runs in Node.js without browser overhead (10-100x faster)
2. **No Server Required**: Unit/integration tests don't need a running dev server
3. **Better Developer Experience**: Fast feedback, watch mode, better error messages
4. **Direct Function Testing**: Test functions directly without HTTP requests
5. **Better Mocking**: Native support for mocking with `vi.mock()`

### Running Vitest Tests

```bash
# Run all tests once
npm run test

# Watch mode (recommended for development)
npm run test:watch

# Run with UI
npm run test:ui

# Generate coverage
npm run test:coverage

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration
```

### Configuration

Configuration is in `vitest.config.ts`:
- Test environment: Node.js (for server-side tests)
- Path aliases: `~/*` for app imports
- Coverage: v8 provider with thresholds
- Exclusions: E2E tests, build files, node_modules

See `tests/setup.ts` for global test setup and jest-dom matchers.

---

## Property-Based Testing

### Overview

Property-based testing generates random inputs to test functions, automatically discovering edge cases that manual tests might miss. Instead of writing specific test cases, you define **properties** that should always hold true.

### Installation

```bash
npm install --save-dev fast-check
```

### Example

Instead of:
```typescript
it("should format dates correctly", () => {
  expect(formatDate(new Date("2024-01-15"))).toBe("01/15/2024");
});
```

Property-based testing:
```typescript
import { fc } from "fast-check";

it("should always return a string for valid date inputs", () => {
  fc.assert(
    fc.property(
      fc.date({ min: new Date("1900-01-01"), max: new Date("2100-12-31") }),
      (date) => {
        const result = formatDate(date);
        return typeof result === "string" && result.length > 0;
      },
    ),
    { numRuns: 100 },
  );
});
```

### Test Files

- `tests/property/helpers-property.test.ts` - Helper function properties
- `tests/property/nostr-conversion-property.test.ts` - Nostr conversion properties
- `tests/property/scheduling-property.test.ts` - Scheduling algorithm properties

### Running Property-Based Tests

```bash
npm run test:property
```

---

## Security Testing

### Overview

Security testing ensures that SmartFlowSocial is protected against common security vulnerabilities.

### Test Coverage

Located in `tests/security/`, these tests verify:

1. **XSS Prevention** (`xss-prevention.test.ts`)
   - Script tag removal
   - Inline event handler removal
   - Dangerous protocol removal
   - Safe HTML tag preservation

2. **SQL Injection Prevention** (`sql-injection.test.ts`)
   - Parameterized query usage
   - SQL injection attempt handling
   - Special character handling

3. **Authentication & Authorization** (`authentication.test.ts`)
   - Session management
   - Authentication checks
   - Authorization checks
   - Session cookie security

4. **CSRF Protection** (`csrf-protection.test.ts`)
   - Remix's built-in CSRF protection
   - SameSite cookie usage

5. **Input Validation** (`input-validation.test.ts`)
   - Form data validation
   - Query parameter validation
   - Request body validation

6. **File Upload Security** (`file-upload-security.test.ts`)
   - File type validation
   - File size limits
   - Malicious file detection

7. **Security Headers** (`security-headers.test.ts`)
   - Content-Security-Policy
   - X-Frame-Options
   - X-Content-Type-Options

### Running Security Tests

```bash
# Run all security tests
npm run test:security

# Run specific security test file
npm run test tests/security/xss-prevention.test.ts
```

---

## Performance Testing

### Overview

Performance testing ensures that SmartFlowSocial can handle expected load and meets performance benchmarks. We use a combination of:

1. **k6 Load Tests** - For API endpoints and loaders under realistic load
2. **Vitest Unit Performance Tests** - For individual function performance benchmarks

### Installing k6

**macOS:**
```bash
brew install k6
```

**Linux:**
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

**Windows:**
```bash
choco install k6
```

Or download from [k6.io](https://k6.io/docs/getting-started/installation/)

### Running Performance Tests

```bash
# Unit performance tests
npm run test:performance

# k6 load tests
k6 run tests/performance/api-endpoints.js
k6 run tests/performance/bulk-operations.js
k6 run tests/performance/loader-performance.js

# All performance tests
npm run test:performance:all
```

### Performance Benchmarks

| Function | Small (< 100) | Medium (100-1000) | Large (1000+) |
|----------|---------------|-------------------|---------------|
| `combineContent()` | < 50ms | < 200ms | < 1000ms |
| `getPostStats()` (single) | < 500ms | - | - |
| `getPostStats()` (10-50) | - | < 2000ms | - |
| `getPostStats()` (50-100) | - | - | < 5000ms |

### Test Files

- `tests/performance/unit-performance.test.ts` - Unit performance benchmarks
- `tests/performance/api-endpoints.js` - API endpoint load tests
- `tests/performance/bulk-operations.js` - Bulk operations load tests
- `tests/performance/loader-performance.js` - Loader performance tests

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

See [Testing Patterns Guide](./testing-patterns.md) for more examples.

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

See [Test Strategy](./TEST_STRATEGY.md#coverage-strategy) for coverage details.

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

See [CI/CD Guide](./ci-cd.md) for details.

---

## Documentation

- [Test Strategy](./test-strategy.md) - Overall testing strategy, philosophy, and coverage goals
- [Testing Patterns](./testing-patterns.md) - Common testing patterns and examples
- [Testing Patterns](./testing-patterns.md) - Includes mocking patterns and guidelines
- [Test Troubleshooting](./test-troubleshooting.md) - Common issues and solutions
- [Test Database](./test-database.md) - Database integration testing guide
- [CI/CD Guide](../ci-cd.md) - CI/CD pipeline documentation

> **Note**: Vitest setup, property-based testing, security testing, and performance testing are now covered in this document (see sections above).

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

See [Test Troubleshooting Guide](./test-troubleshooting.md) for more solutions.

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

See [Testing Patterns Guide](./testing-patterns.md) for more best practices.

---

## Next Steps

- Read [Test Strategy](./test-strategy.md) to understand testing philosophy and coverage goals
- Review [Testing Patterns](./testing-patterns.md) for common patterns
- Review [Testing Patterns](./testing-patterns.md) for mocking strategies
- See [Test Database](./test-database.md) for database testing guidance
