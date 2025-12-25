# Test Strategy

**Date**: 2025-12-25  
**Status**: Comprehensive testing strategy implemented

## Overview

SmartFlowSocial uses a **hybrid testing approach** combining multiple testing frameworks and techniques to ensure code quality, reliability, and maintainability.

## Testing Philosophy

### 1. Test Pyramid

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

### 2. Testing Principles

- **Fast Feedback**: Unit tests run in milliseconds
- **Isolation**: Tests don't depend on external services
- **Repeatability**: Tests produce consistent results
- **Maintainability**: Tests are easy to understand and update
- **Coverage**: Aim for 70-80% overall coverage
- **Quality over Quantity**: Focus on meaningful tests

## Test Types and When to Use Them

### Unit Tests

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

**Location**: `tests/unit/*.test.ts`

**Framework**: Vitest

**Speed**: Very fast (< 100ms per test)

### Integration Tests

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

**Location**: `tests/integration/*.test.ts`

**Framework**: Vitest

**Speed**: Fast (< 1s per test)

### Property-Based Tests

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

**Location**: `tests/property/*.test.ts`

**Framework**: Vitest + fast-check

**Speed**: Medium (1-5s per test)

### Security Tests

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

**Location**: `tests/security/*.test.ts`

**Framework**: Vitest

**Speed**: Fast (< 1s per test)

### Performance Tests

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

**Location**: `tests/performance/*.test.ts` (Vitest) and `tests/performance/*.js` (k6)

**Framework**: Vitest + k6

**Speed**: Variable (depends on test type)

### E2E Tests (Cypress)

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

**Location**: `cypress/e2e/*.cy.ts`

**Framework**: Cypress

**Speed**: Slow (5-30s per test)

## Coverage Strategy

### Coverage Goals

| Metric | Current | Target | Critical Paths |
|--------|---------|--------|----------------|
| Overall | 70-75% | 80% | 95%+ |
| Unit Tests | 40% | 60-70% | 90%+ |
| Integration Tests | 70% | 80-90% | 95%+ |
| E2E Tests | 40% | 50-60% | 80%+ |

### Coverage Thresholds

Enforced in CI/CD:

- **Lines**: 70%
- **Functions**: 65%
- **Branches**: 60%
- **Statements**: 70%

### What to Test

**High Priority:**
- Business logic functions
- Critical user flows
- Security-sensitive code
- Error handling
- Data transformations

**Medium Priority:**
- API routes
- Loaders and actions
- Model functions
- Utility functions

**Low Priority:**
- Simple getters/setters
- Configuration files
- Type definitions

### What NOT to Test

- Third-party library code
- Framework code (Remix, Prisma)
- Generated code
- Simple pass-through functions
- Configuration constants

## Test Organization

### Directory Structure

```
tests/
├── unit/              # Pure function tests
├── integration/       # Integration tests
├── property/          # Property-based tests
├── security/          # Security tests
├── performance/       # Performance tests
├── factories/        # Test data factories
└── utils/            # Test utilities
```

### Naming Conventions

- Test files: `*.test.ts` (Vitest) or `*.cy.ts` (Cypress)
- Test suites: `describe("Feature Name", () => { ... })`
- Test cases: `it("should do something", () => { ... })`
- Test data: Use factories, not manual object creation

## Testing Workflow

### Development Workflow

1. **Write Code**: Implement feature
2. **Write Tests**: Write tests alongside code
3. **Run Tests**: `npm run test:watch`
4. **Refactor**: Improve code and tests
5. **Commit**: Commit with tests passing

### Pre-Commit Checklist

- [ ] All tests pass locally
- [ ] Coverage thresholds met
- [ ] No new linting errors
- [ ] Tests are readable and maintainable
- [ ] Test names are descriptive

### CI/CD Workflow

1. **Lint & Type Check**: ESLint and TypeScript validation
2. **Unit Tests**: Fast unit test suite
3. **Integration Tests**: Integration test suite
4. **Property-Based Tests**: Property-based test suite
5. **Security Tests**: Security test suite
6. **Performance Tests**: Performance test suite
7. **Coverage Check**: Coverage threshold validation
8. **Build**: Application build
9. **Deploy**: Production deployment

## Test Quality Standards

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

## Continuous Improvement

### Metrics to Track

- **Coverage**: Line, branch, function, statement coverage
- **Test Execution Time**: Total time, per-test time
- **Flaky Test Rate**: Percentage of flaky tests
- **Test Failure Rate**: Percentage of failing tests
- **Test Maintenance Burden**: Time spent fixing tests

### Regular Reviews

- Review test coverage monthly
- Identify and fix flaky tests
- Refactor slow tests
- Update test documentation
- Share testing best practices

## Resources

- [Testing Patterns Guide](./TESTING_PATTERNS.md) - Common testing patterns
- [Mocking Guidelines](./MOCKING_GUIDELINES.md) - How to mock dependencies
- [Coverage Goals](./COVERAGE_GOALS.md) - Coverage targets
- [Test Troubleshooting](./TEST_TROUBLESHOOTING.md) - Common issues

