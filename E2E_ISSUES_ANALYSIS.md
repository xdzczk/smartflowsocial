# E2E Test Failures - Production Code Issues Analysis

## Critical Issues Identified

### 1. `withErrorHandling is not a function` ❌ **PRODUCTION CODE BUG**

**Error**: `(0 , import_error_handler.withErrorHandling) is not a function`

**Impact**: 
- Affects ~50 routes that use `withErrorHandling` wrapper
- Causes routes to crash when accessed
- Breaking multiple e2e tests

**Root Cause**:
- Function exists in source code (`app/lib/error-handler.server.ts`)
- Function exists in build (`build/index.js` shows `function withErrorHandling(loaderFn)`)
- Export pattern uses getter: `withErrorHandling: () => withErrorHandling`
- At runtime, the export is `undefined`

**Evidence**:
```bash
$ node -e "const build = require('./build/index.js'); console.log(typeof build.withErrorHandling);"
# Output: undefined
```

**Solution**:
1. **Rebuild the server** - The build may be stale or have a bundling issue
   ```bash
   pnpm build
   ```

2. **If rebuild doesn't work**, this is a Remix bundling issue. The getter pattern `() => withErrorHandling` may be evaluated before the function is hoisted. May need to:
   - Check Remix version compatibility
   - Verify `sideEffects: false` in package.json isn't causing tree-shaking issues
   - Consider exporting differently (named export vs getter)

### 2. Rate Limiting Still Blocking Tests ⚠️ **PARTIALLY FIXED**

**Error**: `429: Too Many Requests` (line 524 in test output)

**Impact**: Tests can't access `/login` and `/nostr-auth` routes

**Root Cause**:
- `skip` function is implemented correctly
- Environment variable `E2E_TEST` may not be set when server starts
- Server needs restart after code changes

**Current Implementation**:
```typescript
skip: (req: Request) => isTestEnvironment(), // Should skip in tests
```

**Solution**:
1. **Restart server with environment variable**:
   ```bash
   E2E_TEST=true pnpm dev
   ```

2. **Or use the updated test scripts**:
   ```bash
   pnpm test:e2e:run  # Now passes E2E_TEST=true to server
   ```

3. **Verify skip is working** - Add logging to confirm:
   ```typescript
   skip: (req: Request) => {
     const shouldSkip = isTestEnvironment();
     if (shouldSkip) console.log('[Rate Limit] Skipping in test environment');
     return shouldSkip;
   }
   ```

## Test-Specific Issues (Not Production Code)

### 3. Element Visibility Issues
- Elements with `position: fixed` not visible
- Tests need `cy.scrollIntoView()` before interacting
- **Fix**: Update tests to scroll elements into view

### 4. Performance Test Thresholds
- Some performance tests may have unrealistic thresholds
- **Fix**: Adjust thresholds or mark as flaky

## Immediate Actions Required

### Priority 1: Fix `withErrorHandling` (Critical)
```bash
# 1. Clean build
rm -rf build/
pnpm build

# 2. Verify function exists
node -e "const build = require('./build/index.js'); console.log('withErrorHandling:', typeof build.withErrorHandling);"

# 3. If still undefined, check Remix bundling
```

### Priority 2: Verify Rate Limiting Fix
```bash
# 1. Start server with test environment
E2E_TEST=true pnpm dev

# 2. In another terminal, run tests
pnpm test:e2e --spec "tests/e2e/smoke.cy.ts"

# 3. Should NOT see 429 errors
```

## Files Modified

1. ✅ `app/lib/rate-limit.server.ts` - Added test environment detection
2. ✅ `package.json` - Updated test scripts to pass `E2E_TEST=true`

## Expected Results After Fixes

- ✅ `withErrorHandling` should be available after rebuild
- ✅ Rate limiting should be disabled in tests (no 429 errors)
- ⚠️ Some test failures may remain (element visibility, performance) - these are test issues

## Next Steps

1. **Rebuild server** to fix `withErrorHandling` issue
2. **Restart server with `E2E_TEST=true`** to verify rate limiting fix
3. **Run smoke test** to verify both fixes work
4. **Fix remaining test issues** (element visibility, etc.)


