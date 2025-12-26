# Vitest Integration Guide

This document explains the Vitest setup and answers common questions about when to use Vitest vs Cypress.

## Quick Answer: Unit Tests AND Integration Tests

**Vitest should be used for BOTH unit tests AND integration tests.**

- ✅ **Unit Tests**: Pure functions, utilities, business logic (no browser needed)
- ✅ **Integration Tests**: Remix loaders, API routes, server-side logic (no browser needed)
- ❌ **E2E Tests**: Full browser flows, UI interactions (use Cypress)

## Why Vitest?

### Benefits Over Cypress for Unit/Integration Tests

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

## Installation

Run this command to install Vitest and related dependencies:

```bash
npm install --save-dev vitest @vitest/ui @vitest/coverage-v8 jsdom @testing-library/react @testing-library/jest-dom happy-dom
```

## Project Structure

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

## Running Tests

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

## Migration from Cypress

### Before (Cypress - Slow)
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

### After (Vitest - Fast)
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

## Writing Integration Tests

### Example: Testing a Remix Loader

```typescript
import { describe, it, expect } from "vitest";
import { json } from "@remix-run/node";

describe("Dashboard Loader", () => {
  it("should return dashboard data", async () => {
    // Mock the loader function
    const loader = async ({ request }: { request: Request }) => {
      // Your loader logic here
      return json({ posts: [], stats: {} });
    };

    // Create a mock request
    const request = new Request("http://localhost:3000/dashboard");
    
    // Call the loader
    const response = await loader({ request });
    const data = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(data).toHaveProperty("posts");
    expect(data).toHaveProperty("stats");
  });
});
```

## Configuration Files

### `vitest.config.ts`
- Configures test environment (Node.js)
- Sets up path aliases (`~/*`)
- Configures coverage reporting
- Excludes Cypress and build directories

### `tests/setup.ts`
- Extends Vitest with jest-dom matchers
- Sets up global test environment
- Configures mocks and cleanup

## Next Steps

1. **Install dependencies**: Run the npm install command above
2. **Run tests**: `npm run test` to verify everything works
3. **Migrate more tests**: Gradually move Cypress unit/integration tests to Vitest
4. **Keep Cypress for E2E**: Continue using Cypress for full browser tests

## Benefits Summary

- ⚡ **10-100x faster** than Cypress for unit/integration tests
- 🚀 **No server required** - tests run directly in Node.js
- 💻 **Better DX** - watch mode, UI, better error messages
- 🎯 **Focused testing** - test logic without browser overhead
- 📊 **Coverage reports** - built-in coverage support

## Questions?

- See `docs/testing.md` for detailed testing guide
- See `tests/integration/example-loader.test.ts` for integration test examples
- See `tests/unit/` for unit test examples

