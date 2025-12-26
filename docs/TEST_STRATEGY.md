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

**Location**: `tests/e2e/**/*.cy.ts`

**Framework**: Cypress

**Speed**: Slow (5-30s per test)

## Coverage Strategy

### Coverage Goals

#### Overall Coverage

- **Current**: 70-75%
- **Target**: 80%
- **Critical Paths**: 95%+

#### By Test Type

| Test Type | Current | Target | Status |
|-----------|---------|--------|--------|
| Unit Tests | 40% | 60-70% | 🟡 In Progress |
| Integration Tests | 70% | 80-90% | 🟢 Good |
| E2E Tests | 40% | 50-60% | 🟡 In Progress |
| Property-Based | 3 functions | 10+ functions | 🟡 In Progress |
| Security Tests | 7 areas | 7 areas | ✅ Complete |
| Performance Tests | 3 areas | 5+ areas | 🟡 In Progress |

### Coverage Thresholds

#### Enforced Thresholds

Coverage thresholds are enforced in CI/CD and `vitest.config.ts`:

| Metric | Threshold | Rationale |
|--------|-----------|-----------|
| **Lines** | 70% | Ensures most code paths are tested |
| **Functions** | 65% | Ensures most functions have tests |
| **Branches** | 60% | Ensures conditional logic is tested |
| **Statements** | 70% | Ensures most statements execute |

#### Threshold Rationale

**Why 70% for Lines and Statements?**
- High enough to catch most bugs
- Achievable without excessive effort
- Leaves room for hard-to-test code
- Industry standard for most projects

**Why 65% for Functions?**
- Functions are easier to test than branches
- Some functions are simple getters/setters
- Focus on testing complex functions

**Why 60% for Branches?**
- Branches are harder to test (conditionals, error paths)
- Some branches are defensive (unlikely to execute)
- Focus on critical decision points

### Coverage Goals by Area

#### Critical Paths (95%+)

**Areas:**
- Authentication/authorization
- Payment processing
- Post publishing
- Queue scheduling
- Error handling

**Rationale**: These areas have high business impact and security implications.

#### High Priority (80-90%)

**Areas:**
- API routes
- Action handlers
- Loaders
- Model functions
- Business logic services

**Rationale**: These are core functionality that users interact with directly.

#### Medium Priority (70-80%)

**Areas:**
- Utility functions
- Helper functions
- Data transformations
- Formatting functions

**Rationale**: Important but less critical than core business logic.

#### Low Priority (50-60%)

**Areas:**
- Configuration files
- Type definitions
- Simple getters/setters
- Pass-through functions

**Rationale**: Less critical, but still should have some coverage.

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

**Excluded from Coverage:**
- Third-party library code
- Framework code (Remix, Prisma)
- Generated code
- Simple pass-through functions
- Configuration constants
- Test files themselves
- Build artifacts
- Type definitions (`*.d.ts`)
- Config files (`*.config.*`)

### Coverage Reporting

#### Running Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# View HTML report
open coverage/index.html

# Coverage with thresholds check
./scripts/coverage-report.sh
```

#### Coverage Configuration

Coverage is configured in `vitest.config.ts` with the following settings:

- **Provider**: v8 (fast and accurate)
- **Reporters**: text, json, json-summary, html, lcov
- **Thresholds**:
  - Lines: 70%
  - Functions: 65%
  - Branches: 60%
  - Statements: 70%

#### Coverage Exclusions

The following are excluded from coverage:
- `node_modules/`
- `build/`
- `tests/e2e/`
- `tests/`
- `prisma/`
- Type definitions (`**/*.d.ts`)
- Config files (`**/*.config.*`)
- Entry files (`**/entry.*`)
- Root component (`**/root.tsx`)
- Styles (`**/tailwind.css`)
- Server files (`server.ts`, `worker.ts`)

#### Coverage Reports

**HTML Report**:
```bash
npm run test:coverage
open coverage/index.html
```

Shows:
- File-by-file coverage
- Line-by-line highlighting
- Branch coverage details
- Function coverage details

**JSON Summary** (`coverage/coverage-summary.json`):
- Overall coverage percentages
- Per-file coverage
- Per-directory coverage

Useful for CI/CD integration and coverage tracking tools.

**LCOV Report** (`coverage/lcov.info`):
Compatible with:
- Codecov
- Coveralls
- SonarQube
- Other coverage tools

#### Coverage Trend Tracking

Track coverage over time:

```bash
# Record snapshot after each test run
npm run test:coverage && node scripts/coverage-trend.js record

# View trends
node scripts/coverage-trend.js report
```

The trend tracking:
- Records coverage snapshots over time
- Keeps last 100 snapshots
- Shows coverage trends (increasing/decreasing)
- Helps identify coverage regressions

#### CI/CD Integration

**GitHub Actions**:
A GitHub Actions workflow (`.github/workflows/coverage.yml`) is configured to:
1. Run tests with coverage on PRs and pushes
2. Check coverage thresholds
3. Upload coverage to Codecov (if configured)
4. Comment on PRs with coverage information
5. Upload coverage artifacts

**Codecov Integration**:
To enable Codecov:
1. Sign up at [codecov.io](https://codecov.io)
2. Add your repository
3. Get your Codecov token
4. Add `CODECOV_TOKEN` to GitHub secrets
5. The workflow will automatically upload coverage

#### Adjusting Thresholds

Edit `vitest.config.ts`:

```typescript
coverage: {
  thresholds: {
    lines: 75,      // Increase to 75%
    functions: 70,  // Increase to 70%
    branches: 65,   // Increase to 65%
    statements: 75, // Increase to 75%
  },
}
```

**Threshold Strategy**:
1. **Start Low**: Begin with achievable thresholds (50-60%)
2. **Gradually Increase**: Raise thresholds as coverage improves
3. **Maintain**: Keep thresholds at sustainable levels
4. **Per-File**: Consider per-file thresholds for critical code

#### Coverage Best Practices

1. **Regular Coverage Checks**: Run coverage checks regularly (before committing, in CI/CD, before releases)
2. **Coverage Reviews**: Review coverage reports to identify untested code paths, find missing edge cases, discover dead code
3. **Incremental Improvement**: Improve coverage incrementally - focus on high-impact areas first, add tests for new code, gradually increase thresholds
4. **Coverage vs Quality**: Remember that coverage ≠ quality. High coverage doesn't mean good tests. Focus on critical paths and avoid coverage gaming.

#### Troubleshooting

**Coverage Not Generating**:
1. Check that `@vitest/coverage-v8` is installed
2. Verify coverage provider in `vitest.config.ts`
3. Check that tests are actually running

**Thresholds Not Enforced**:
1. Verify thresholds in `vitest.config.ts`
2. Check that coverage is actually below threshold
3. Ensure `reportOnFailure: true` is set

**Coverage Reports Missing Files**:
1. Check exclusion patterns in `vitest.config.ts`
2. Verify files are in included directories
3. Check that files are actually executed by tests

#### Coverage Reports

The coverage system generates multiple report formats:

- **HTML Report** (`coverage/index.html`) - Most detailed, file-by-file coverage
- **JSON Summary** (`coverage/coverage-summary.json`) - For CI/CD integration
- **LCOV Report** (`coverage/lcov.info`) - Compatible with Codecov, Coveralls, SonarQube
- **Text Report** - Console output

#### Coverage Tracking

Track coverage trends over time:

```bash
# Record current coverage snapshot
npm run test:coverage:report

# View coverage trend report
npm run test:coverage:trend
```

The trend tracking:
- Records coverage snapshots over time
- Keeps last 100 snapshots
- Shows coverage trends (increasing/decreasing)
- Helps identify coverage regressions

#### CI/CD Integration

Coverage is automatically checked in CI/CD:
- Runs tests with coverage on PRs and pushes
- Checks coverage thresholds
- Fails build if thresholds not met
- Uploads coverage artifacts

### Adjusting Thresholds

Edit `vitest.config.ts`:

```typescript
coverage: {
  thresholds: {
    lines: 75,      // Increase to 75%
    functions: 70,  // Increase to 70%
    branches: 65,   // Increase to 65%
    statements: 75, // Increase to 75%
  },
}
```

**Threshold Strategy:**
1. **Start Low**: Begin with achievable thresholds (50-60%)
2. **Gradually Increase**: Raise thresholds as coverage improves
3. **Maintain**: Keep thresholds at sustainable levels
4. **Per-File**: Consider per-file thresholds for critical code

### Coverage Best Practices

1. **Focus on Quality**: High coverage doesn't mean good tests
2. **Test Behavior, Not Implementation**: Focus on what functions do
3. **Prioritize Critical Paths**: Some code needs more coverage than others
4. **Maintain Sustainable Levels**: Don't sacrifice test quality for coverage
5. **Review Regularly**: Identify untested code paths and missing edge cases

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

