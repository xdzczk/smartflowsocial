# Coverage Goals and Rationale

**Date**: 2025-12-25  
**Status**: Coverage goals defined and enforced

## Overview

This document outlines test coverage goals, rationale, and strategies for SmartFlowSocial.

## Current Coverage

### Overall Coverage

- **Current**: 70-75%
- **Target**: 80%
- **Critical Paths**: 95%+

### By Test Type

| Test Type | Current | Target | Status |
|-----------|---------|--------|--------|
| Unit Tests | 40% | 60-70% | 🟡 In Progress |
| Integration Tests | 70% | 80-90% | 🟢 Good |
| E2E Tests | 40% | 50-60% | 🟡 In Progress |
| Property-Based | 3 functions | 10+ functions | 🟡 In Progress |
| Security Tests | 7 areas | 7 areas | ✅ Complete |
| Performance Tests | 3 areas | 5+ areas | 🟡 In Progress |

## Coverage Thresholds

### Enforced Thresholds

Coverage thresholds are enforced in CI/CD and `vitest.config.ts`:

| Metric | Threshold | Rationale |
|--------|-----------|-----------|
| **Lines** | 70% | Ensures most code paths are tested |
| **Functions** | 65% | Ensures most functions have tests |
| **Branches** | 60% | Ensures conditional logic is tested |
| **Statements** | 70% | Ensures most statements execute |

### Threshold Rationale

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

## Coverage Goals by Area

### Critical Paths (95%+)

**Areas:**
- Authentication/authorization
- Payment processing
- Post publishing
- Queue scheduling
- Error handling

**Rationale**: These areas have high business impact and security implications.

### High Priority (80-90%)

**Areas:**
- API routes
- Action handlers
- Loaders
- Model functions
- Business logic services

**Rationale**: These are core functionality that users interact with directly.

### Medium Priority (70-80%)

**Areas:**
- Utility functions
- Helper functions
- Data transformations
- Formatting functions

**Rationale**: Important but less critical than core business logic.

### Low Priority (50-60%)

**Areas:**
- Configuration files
- Type definitions
- Simple getters/setters
- Pass-through functions

**Rationale**: Low risk, simple code that's less likely to have bugs.

## What to Test

### High Priority

✅ **Business Logic**
- Scheduling algorithms
- Content combining
- Statistics calculation
- Validation logic

✅ **Security-Sensitive Code**
- Authentication
- Authorization
- Input sanitization
- File upload validation

✅ **Critical User Flows**
- Post creation
- Post publishing
- Payment processing
- Queue management

✅ **Error Handling**
- Error classes
- Error responses
- Error logging

### Medium Priority

✅ **API Routes**
- Request validation
- Response formatting
- Error handling

✅ **Data Operations**
- CRUD operations
- Data transformations
- Query building

✅ **Integration Points**
- External API calls
- Database operations
- File system operations

### Low Priority

⚠️ **Simple Functions**
- Getters/setters
- Type conversions
- Simple validations

⚠️ **Configuration**
- Constants
- Default values
- Configuration parsing

## What NOT to Test

### Excluded from Coverage

❌ **Third-Party Code**
- Remix framework code
- Prisma ORM code
- External library code

❌ **Generated Code**
- Type definitions
- Build artifacts
- Auto-generated files

❌ **Simple Pass-Throughs**
- Simple getters
- Simple setters
- Wrapper functions with no logic

❌ **Configuration Files**
- Config files
- Environment files
- Build scripts

## Coverage Strategy

### Incremental Improvement

1. **Start Low**: Begin with achievable thresholds (50-60%)
2. **Gradually Increase**: Raise thresholds as coverage improves
3. **Maintain**: Keep thresholds at sustainable levels
4. **Focus on Quality**: Better to have fewer, better tests than many poor tests

### Coverage by File Type

**Server-Side Code**: 70-80%
- Models: 80%+
- Services: 75%+
- Utilities: 70%+

**Client-Side Code**: 50-60%
- Components: 50%+
- Hooks: 60%+
- Utilities: 70%+

**Tests**: Excluded
- Test files themselves
- Test utilities
- Test factories

## Coverage Tracking

### Tools

- **Vitest Coverage**: Built-in coverage reporting
- **Coverage Trends**: `scripts/coverage-trend.js`
- **CI/CD Integration**: Automated coverage checks
- **Codecov** (optional): External coverage tracking

### Metrics to Track

- **Overall Coverage**: Total percentage
- **Coverage by Type**: Unit, integration, E2E
- **Coverage by Area**: Models, services, routes
- **Coverage Trends**: Changes over time
- **Gap Analysis**: Areas with low coverage

### Reporting

- **HTML Reports**: `coverage/index.html`
- **JSON Summary**: `coverage/coverage-summary.json`
- **LCOV Reports**: `coverage/lcov.info`
- **CI/CD Reports**: GitHub Actions artifacts

## Coverage Goals Roadmap

### Phase 1: Foundation (Current)

- ✅ Unit tests: 40%
- ✅ Integration tests: 70%
- ✅ Overall: 70-75%

### Phase 2: Improvement (Next 3 months)

- 🎯 Unit tests: 60%
- 🎯 Integration tests: 80%
- 🎯 Overall: 75-80%

### Phase 3: Excellence (6+ months)

- 🎯 Unit tests: 70%
- 🎯 Integration tests: 90%
- 🎯 Overall: 80%+

## Adjusting Thresholds

### When to Increase

- Coverage consistently exceeds threshold
- Team has capacity for more tests
- Critical areas need higher coverage

### When to Decrease

- Thresholds are consistently not met
- Team struggling to maintain coverage
- Unrealistic for current codebase

### How to Adjust

Edit `vitest.config.ts`:

```typescript
coverage: {
  thresholds: {
    lines: 75,      // Increase from 70%
    functions: 70,  // Increase from 65%
    branches: 65,   // Increase from 60%
    statements: 75, // Increase from 70%
  },
}
```

## Best Practices

### 1. Focus on Quality

Better to have fewer, high-quality tests than many poor tests.

### 2. Test Behavior, Not Implementation

Focus on what code does, not how it does it.

### 3. Prioritize Critical Paths

Focus coverage efforts on high-impact areas.

### 4. Maintain Sustainable Levels

Set thresholds that are achievable and maintainable.

### 5. Review Regularly

Review coverage monthly and adjust goals as needed.

## Resources

- [Coverage Reporting Guide](./COVERAGE_REPORTING.md) - How to track coverage
- [Test Strategy](./TEST_STRATEGY.md) - Overall testing strategy
- [Testing Patterns](./TESTING_PATTERNS.md) - Common testing patterns

