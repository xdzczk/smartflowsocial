# Test Migration Plan: Cypress → Vitest

## Current State

✅ **Already Migrated:**

### Unit Tests (4 files, 112 tests) - All passing in Vitest
  - `tests/unit/scheduling-logic.test.ts`
  - `tests/unit/engagement-logic.test.ts`
  - `tests/unit/subscription-logic.test.ts`
  - `tests/unit/error-classes.test.ts`

### Integration Tests (6 files) - Loader function tests
  - `tests/integration/dashboard-loader.test.ts` ✅
  - `tests/integration/scheduled-loader.test.ts` ✅
  - `tests/integration/calendar-loader.test.ts` ✅
  - `tests/integration/drafts-loader.test.ts` ✅
  - `tests/integration/posted-loader.test.ts` ✅
  - `tests/integration/subscription-loader.test.ts` ✅

## Migration Strategy

### ✅ Migrate to Vitest (Fast, No Browser)

**Loader Function Tests** - Test the actual loader logic:
- Authentication/authorization checks
- Data fetching and transformation
- Error handling
- Query parameter parsing
- Response structure

**Benefits:**
- 10-100x faster than Cypress
- No dev server required
- Direct function testing
- Better error messages
- Can mock dependencies easily

### ❌ Keep in Cypress (E2E, Browser Required)

**UI Rendering Tests** - Test that UI displays correctly:
- Page loads without errors
- UI elements are visible
- Content is displayed
- User interactions work
- Full user flows

**Why Keep:**
- Tests real browser rendering
- Tests actual user experience
- Catches CSS/layout issues
- Tests JavaScript in browser context

## Recommended Migration

### Phase 1: Loader Function Tests (High Value, Low Risk) ✅ COMPLETED

Migrated these Cypress tests to Vitest by testing the loader functions directly:

1. **Dashboard Loader** ✅
   - `tests/integration/dashboard-loader.test.ts`
   - Tests `loadDashboardData()` function
   - Tests authentication/authorization
   - Tests query parameter handling
   - Tests data structure returned

2. **Scheduled Posts Loader** ✅
   - `tests/integration/scheduled-loader.test.ts`
   - Tests `loadScheduledData()` function
   - Tests queue type filtering
   - Tests data structure

3. **Calendar Loader** ✅
   - `tests/integration/calendar-loader.test.ts`
   - Tests calendar data loading
   - Tests queue type filtering
   - Tests schedule intervals

4. **Drafts Loader** ✅
   - `tests/integration/drafts-loader.test.ts`
   - Tests `loadDraftsData()` function
   - Tests feature access checks

5. **Posted Posts Loader** ✅
   - `tests/integration/posted-loader.test.ts`
   - Tests `getPostedDashboardData()` function
   - Tests queue type filtering

6. **Subscription/Billing Loader** ✅
   - `tests/integration/subscription-loader.test.ts`
   - Tests `loadSettingsData()` function
   - Tests subscription status checks
   - Tests payment history loading

### Phase 2: Keep UI Tests in Cypress

Keep these tests in Cypress (they test UI rendering):
- "should load dashboard without errors" → Keep in Cypress
- "should display statistics component" → Keep in Cypress
- "should display queue selection tabs" → Keep in Cypress

### Phase 3: Clean Up

After migration:
- Remove duplicate unit tests from `tests/e2e/unit/` (already migrated)
- Update test documentation
- Update CI/CD to run both Vitest and Cypress

## Example Migration

### Before (Cypress - Slow, Tests UI)
```typescript
// tests/e2e/loaders/dashboard-loader.cy.ts
it("should load dashboard without errors", () => {
  cy.visitAndCheck("/dashboard");
  cy.location("pathname").should("include", "dashboard");
});
```

### After (Vitest - Fast, Tests Logic)
```typescript
// tests/integration/dashboard-loader.test.ts
import { describe, it, expect, vi } from "vitest";

import { loader } from "~/routes/dashboard._index";

describe("Dashboard Loader", () => {
  it("should return dashboard data for authenticated user", async () => {
    // Mock authentication
    vi.mock("~/features/auth/session.server", () => ({
      requireUserId: vi.fn().mockResolvedValue("user-123"),
    }));

    const request = new Request("http://localhost:3000/dashboard");
    const response = await loader({ request, params: {} });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("scheduledPosts");
    expect(data).toHaveProperty("queueTypes");
  });
});
```

### Keep in Cypress (UI Rendering)
```typescript
// tests/e2e/dashboard.cy.ts
it("should display dashboard UI correctly", () => {
  cy.loginNostr();
  cy.visitAndCheck("/dashboard");
  cy.get("[data-testid='statistics']").should("be.visible");
  cy.get("[role='tablist']").should("exist");
});
```

## Benefits of This Approach

1. **Fast Feedback**: Loader logic tests run in milliseconds
2. **Better Coverage**: Can test edge cases and error paths easily
3. **No Server Required**: Vitest tests run without dev server
4. **UI Confidence**: Cypress still tests real browser rendering
5. **Best of Both**: Fast unit/integration tests + thorough E2E tests

## Next Steps

1. ✅ Unit tests migrated (DONE)
2. ✅ Loader function tests migrated (DONE)
3. ⏸️ Keep UI rendering tests in Cypress (KEEP - These test browser rendering)
4. 📝 Update documentation (DONE)
5. 🧪 Run tests to verify everything works
6. 📊 Compare test execution times (Vitest vs Cypress)

## Migration Results

### Test Files Created
- **6 integration test files** covering all major loaders
- **4 unit test files** covering business logic
- **Total**: 10 test files migrated to Vitest

### Estimated Impact
- **Before**: ~15-30 seconds for loader tests in Cypress (requires dev server)
- **After**: ~1-2 seconds for loader tests in Vitest (no server needed)
- **Speed Improvement**: 10-15x faster
- **Developer Experience**: Much better (watch mode, faster feedback, no server required)

### What's Left in Cypress
- UI rendering tests (should stay in Cypress)
- Full user flow tests (should stay in Cypress)
- Browser interaction tests (should stay in Cypress)

