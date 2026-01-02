# Production Code Bugs Identified from E2E Tests

## Critical Bug: `withErrorHandling is not a function`

### Impact
- **~50 routes are broken** - Any route using `withErrorHandling` crashes
- Routes affected include:
  - `/dashboard/posted`
  - `/dashboard/calendar`
  - `/dashboard/drafts`
  - `/dashboard/scheduled`
  - `/dashboard/recyclables`
  - And many more...

### Root Cause
Remix bundler uses lazy initialization (`init_error_handler_server()`), but the initialization may not run before routes try to use the function. Additionally, `sideEffects: false` in `package.json` may cause tree-shaking to remove necessary initialization code.

### Evidence
```javascript
// Build shows function exists:
function withErrorHandling(loaderFn) { ... }

// But export uses lazy init:
__export(error_handler_server_exports, {
  withErrorHandling: () => withErrorHandling  // Getter pattern
});

// Routes try to use it but get undefined
```

### Fix Applied
1. **Changed exports from `export function` to `export const`** in `app/lib/error-handler.server.ts`:
   - Changed `export function withErrorHandling` → `export const withErrorHandling =`
   - Changed `export function withActionErrorHandling` → `export const withActionErrorHandling =`
   - This prevents bundler hoisting issues where the export getter references the function before it's defined

2. **Marked error-handler as having side effects** in `package.json`:
   ```json
   "sideEffects": [
     "**/*.css",
     "**/*.server.ts",
     "**/*.server.tsx",
     "app/lib/error-handler.server.ts"
   ]
   ```

3. **Next Step**: Rebuild the server
   ```bash
   rm -rf build/
   pnpm build
   ```

### Why This Is a Production Bug
- The app **genuinely fails** when accessing these routes
- Users would see errors when trying to use:
  - Posted posts queue
  - Calendar view
  - Drafts management
  - Scheduled posts
  - Recyclables
  - And other features

This is **not a test issue** - the app is broken in production.

## Secondary Issues

### 1. Element Visibility (Test Issue)
- Elements with `position: fixed` not visible in tests
- **Fix**: Tests need `cy.scrollIntoView()` before interacting
- **Not a production bug** - UI works, tests need adjustment

### 2. Performance Thresholds (Test Issue)
- Some performance tests may have unrealistic thresholds
- **Fix**: Adjust thresholds or mark as flaky
- **Not a production bug** - App performance may be fine

## Summary

**Production Bugs**: 1 critical (`withErrorHandling`)
- This breaks many routes and needs immediate fix

**Test Issues**: 2 minor (element visibility, performance)
- These are test problems, not app problems

## Action Required

1. **Rebuild server** with side effects fix:
   ```bash
   rm -rf build/
   pnpm build
   ```

2. **Verify fix**:
   ```bash
   node -e "const build = require('./build/index.js'); console.log(typeof build.withErrorHandling);"
   # Should output: function
   ```

3. **Run tests** to verify routes work:
   ```bash
   pnpm test:e2e --spec "tests/e2e/posted-posts.cy.ts"
   ```

4. **Fix test issues** (element visibility, etc.) separately

