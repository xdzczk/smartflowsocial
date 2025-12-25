# Test Troubleshooting Guide

**Date**: 2025-12-25  
**Status**: Comprehensive troubleshooting guide

This guide helps you diagnose and fix common test issues.

## Table of Contents

1. [Common Issues](#common-issues)
2. [Vitest Issues](#vitest-issues)
3. [Cypress Issues](#cypress-issues)
4. [Mocking Issues](#mocking-issues)
5. [Coverage Issues](#coverage-issues)
6. [CI/CD Issues](#cicd-issues)

## Common Issues

### Tests Not Running

**Symptoms**: Tests don't execute or show "0 tests"

**Solutions**:
1. Check test file naming: Must be `*.test.ts` or `*.spec.ts`
2. Check test file location: Must be in `tests/` directory
3. Check Vitest config: Verify `include` patterns in `vitest.config.ts`
4. Clear cache: `rm -rf node_modules/.vite`

### Tests Timing Out

**Symptoms**: Tests fail with timeout errors

**Solutions**:
1. Increase timeout in `vitest.config.ts`:
   ```typescript
   testTimeout: 30000, // 30 seconds
   ```
2. Check for infinite loops
3. Check for hanging async operations
4. Use `vi.setTimeout()` for specific tests

### Tests Failing Intermittently (Flaky Tests)

**Symptoms**: Tests pass sometimes, fail other times

**Solutions**:
1. Check for shared state between tests
2. Clear mocks in `beforeEach`:
   ```typescript
   beforeEach(() => {
     vi.clearAllMocks();
   });
   ```
3. Use `vi.useFakeTimers()` for time-dependent tests
4. Run flaky test detection: See [CI/CD Guide](./CI_CD.md)

### Import Errors

**Symptoms**: "Cannot find module" errors

**Solutions**:
1. Check path aliases in `vitest.config.ts`
2. Verify `tsconfig.json` paths match
3. Check file extensions in imports
4. Ensure dependencies are installed

## Vitest Issues

### Module Not Found

**Symptoms**: `Error: Cannot find module '~/lib/...'`

**Solutions**:
1. Check `vitest.config.ts` has path aliases:
   ```typescript
   resolve: {
     alias: {
       "~": resolve(__dirname, "./app"),
     },
   }
   ```
2. Verify `tsconfigPaths` plugin is installed
3. Check `tsconfig.json` has matching paths

### Mock Not Working

**Symptoms**: Mock doesn't affect test behavior

**Solutions**:
1. Ensure mock is before import:
   ```typescript
   vi.mock("~/lib/prisma.server", () => ({ ... }));
   import { getUserById } from "~/models/user.server";
   ```
2. Check mock is in correct scope
3. Clear mocks in `beforeEach`
4. Verify mock return values match expected types

### Coverage Not Generating

**Symptoms**: No coverage report generated

**Solutions**:
1. Check `@vitest/coverage-v8` is installed
2. Verify coverage provider in `vitest.config.ts`:
   ```typescript
   coverage: {
     provider: "v8",
   }
   ```
3. Run with coverage flag: `npm run test:coverage`
4. Check coverage directory exists: `coverage/`

### Test Environment Issues

**Symptoms**: Tests fail with "window is not defined" or similar

**Solutions**:
1. Check test environment in `vitest.config.ts`:
   ```typescript
   test: {
     environment: "node", // For server-side tests
     // or
     environment: "jsdom", // For React component tests
   }
   ```
2. Use correct environment for test type
3. Mock browser APIs if needed

## Cypress Issues

### Connection Refused

**Symptoms**: "Connection refused" errors

**Solutions**:
1. Ensure dev server is running:
   ```bash
   npm run dev
   ```
2. Check server is accessible at `http://localhost:3000`
3. Verify `PORT` environment variable
4. Check firewall settings

### Tests Timing Out

**Symptoms**: Cypress tests timeout

**Solutions**:
1. Increase timeout in `cypress.config.ts` (located at project root):
   ```typescript
   defaultCommandTimeout: 10000,
   ```
2. Use `cy.visitAndCheck()` instead of `cy.visit()`
3. Add explicit waits for async operations
4. Check for slow network requests

### Authentication Issues

**Symptoms**: Tests fail with authentication errors

**Solutions**:
1. Use `cy.loginNostr()` before tests
2. Check test user exists in database
3. Verify session cookies are set
4. Check `tests/e2e/support/nostr-test-keys.ts` has valid keys

### Database Issues

**Symptoms**: Tests fail with database errors

**Solutions**:
1. Ensure PostgreSQL is running:
   ```bash
   npm run docker
   ```
2. Check `.env` has correct `DATABASE_URL`
3. Run migrations: `npx prisma migrate deploy`
4. Verify test database is accessible

## Mocking Issues

### Mock Not Applied

**Symptoms**: Mock doesn't affect function behavior

**Solutions**:
1. Place mock before import:
   ```typescript
   vi.mock("~/lib/prisma.server");
   import { getUserById } from "~/models/user.server";
   ```
2. Check mock is in correct file scope
3. Verify mock path matches import path exactly
4. Use `vi.doMock()` for dynamic mocks

### Mock Return Value Wrong Type

**Symptoms**: Type errors with mock return values

**Solutions**:
1. Ensure mock return values match expected types
2. Use type assertions:
   ```typescript
   (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ ... });
   ```
3. Check Prisma schema for required fields
4. Use factories for consistent test data

### Mock Persisting Between Tests

**Symptoms**: Test results affected by previous tests

**Solutions**:
1. Clear mocks in `beforeEach`:
   ```typescript
   beforeEach(() => {
     vi.clearAllMocks();
   });
   ```
2. Reset mock return values
3. Avoid shared mock state
4. Use `vi.resetAllMocks()` if needed

## Coverage Issues

### Coverage Threshold Failures

**Symptoms**: CI fails with "Coverage threshold not met"

**Solutions**:
1. Review coverage report: `npm run test:coverage`
2. Identify files with low coverage
3. Add missing tests
4. Adjust thresholds if needed (in `vitest.config.ts`)

### Coverage Not Accurate

**Symptoms**: Coverage report shows incorrect percentages

**Solutions**:
1. Check coverage exclusions in `vitest.config.ts`
2. Verify files are included in coverage
3. Run coverage with `--all` flag
4. Check for coverage provider issues

### Coverage Files Missing

**Symptoms**: Coverage report files not generated

**Solutions**:
1. Check coverage directory exists: `coverage/`
2. Verify coverage reporters in `vitest.config.ts`
3. Check file permissions
4. Run coverage command: `npm run test:coverage`

## CI/CD Issues

### Tests Failing in CI

**Symptoms**: Tests pass locally but fail in CI

**Solutions**:
1. Check CI environment variables
2. Verify Node.js version matches local
3. Check for timezone differences
4. Review CI logs for specific errors
5. Run tests in CI mode locally: `CI=true npm run test`

### Coverage Upload Failing

**Symptoms**: Coverage not uploaded to Codecov

**Solutions**:
1. Check `CODECOV_TOKEN` is set in GitHub secrets
2. Verify coverage file exists: `coverage/coverage-summary.json`
3. Check Codecov action configuration
4. Review Codecov action logs

### Flaky Tests in CI

**Symptoms**: Tests fail randomly in CI

**Solutions**:
1. Run flaky test detection workflow
2. Check for race conditions
3. Verify test isolation
4. Add retries for known flaky tests
5. Review CI logs for patterns

## Performance Issues

### Tests Running Slowly

**Symptoms**: Tests take too long to run

**Solutions**:
1. Enable test parallelization:
   ```typescript
   test: {
     threads: true,
   }
   ```
2. Use test result caching
3. Split large test files
4. Optimize slow tests
5. Use `test.only()` for focused testing during development

### Memory Issues

**Symptoms**: Tests fail with memory errors

**Solutions**:
1. Reduce test parallelization
2. Clear large objects after tests
3. Use `vi.clearAllMocks()` to free memory
4. Check for memory leaks in code

## Debugging Tips

### 1. Run Single Test

```bash
npm run test -- tests/unit/helpers.test.ts
```

### 2. Run with Verbose Output

```bash
npm run test -- --reporter=verbose
```

### 3. Use Debugger

```typescript
it("should debug", () => {
  debugger; // Set breakpoint
  // Test code
});
```

### 4. Log Mock Calls

```typescript
console.log(mockPrisma.user.findUnique.mock.calls);
```

### 5. Check Test Isolation

```typescript
beforeEach(() => {
  vi.clearAllMocks();
  // Reset any shared state
});
```

## Getting Help

### Check Documentation

1. [Testing Guide](./testing.md) - Main testing documentation
2. [Testing Patterns](./TESTING_PATTERNS.md) - Common patterns
3. [Mocking Guidelines](./MOCKING_GUIDELINES.md) - Mocking strategies
4. [CI/CD Guide](./CI_CD.md) - CI/CD troubleshooting

### Review Test Examples

- `tests/integration/example-loader.test.ts` - Loader test example
- `tests/unit/helpers.test.ts` - Unit test example
- `tests/factories/example.test.ts` - Factory usage example

### Common Solutions

1. **Clear cache**: `rm -rf node_modules/.vite`
2. **Reinstall dependencies**: `rm -rf node_modules && npm install`
3. **Check environment**: Verify `.env` file exists
4. **Review logs**: Check test output for specific errors
5. **Isolate issue**: Run single test to identify problem

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Cypress Documentation](https://docs.cypress.io/)
- [Testing Patterns](./TESTING_PATTERNS.md)
- [Mocking Guidelines](./MOCKING_GUIDELINES.md)

