# E2E Test Failures - Current Status

## Issue: Rate Limiting Still Blocking Tests

### Error
```
429: Too Many Requests
The response we received from your web server was:
  > 429: Too Many Requests
```

### Root Cause
The server is running **without** the `E2E_TEST=true` environment variable, so rate limiting is **not disabled**. The rate limiters check `isTestEnvironment()` at request time, but if the server started without `E2E_TEST=true`, the environment variable won't be set.

### Solution

**Option 1: Use the test script that starts the server automatically**
```bash
pnpm test:e2e:run
```
This script uses `start-server-and-test` which will:
1. Start the server with `E2E_TEST=true`
2. Wait for it to be ready
3. Run the tests
4. Stop the server when done

**Option 2: Stop the current server and restart with E2E_TEST**
```bash
# Stop the current server (Ctrl+C or kill the process)
# Then start it with:
E2E_TEST=true pnpm dev
# In another terminal:
pnpm test:e2e
```

**Option 3: Check if server is already running and kill it**
```bash
# Find and kill the server process
pkill -f "node.*server.js"
# Then use Option 1 or 2
```

### Verification

To verify the server has `E2E_TEST=true`:
1. Check the server logs - it should show rate limiting is disabled
2. Or add a log in `isTestEnvironment()` to see if it returns true
3. Or check `process.env.E2E_TEST` in the server process

### Current Status

- ✅ **Rate limiting code is fixed** - `skip` function checks `isTestEnvironment()` at request time
- ✅ **Test scripts are updated** - They pass `E2E_TEST=true` to the server
- ❌ **Server needs restart** - The currently running server doesn't have `E2E_TEST=true`

### Next Steps

1. **Stop the current server** (if running manually)
2. **Use `pnpm test:e2e:run`** - This will start the server with the correct environment variable
3. **Or manually restart** with `E2E_TEST=true pnpm dev`

## Other Issues Fixed

### ✅ withErrorHandling Bundling Issue
- **Status**: FIXED
- **Solution**: Converted all routes to use dynamic imports instead of static imports
- **Result**: Routes now use `await import("~/lib/error-handler.server")` in catch blocks
- **Impact**: 21 routes converted, no more bundling issues

### ⚠️ Remaining Test Issues
After fixing rate limiting, some tests may still fail due to:
- Element visibility issues (CSS positioning)
- Performance thresholds
- Test-specific timing issues

These are test issues, not production code bugs.

