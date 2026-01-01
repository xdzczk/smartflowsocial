# Integration Test Fixes - Deep Analysis & Best Practice Plan

## Current Status
- **Total Tests**: 521
- **Passing**: 502 (96.4%)
- **Failing**: 19 (3.6%)
- **Failed Test Files**: 8

## Root Cause Analysis

### Category 1: Module Mocking Mismatches (6 tests)

#### Issue: `~/models/user.server` vs `~/features/user`
**Affected Tests:**
- `queue-workers.test.ts` (7 tests)
- `queue-operations.test.ts` (2 tests)  
- `queue-worker-edge-cases.test.ts` (2 tests)

**Root Cause:**
- Tests mock `~/models/user.server` but actual code imports from `~/features/user`
- `~/models/user.server` is a deprecated re-export that may not work correctly with mocks
- `getUserById` calls fail because mocks aren't applied

**Best Practice Fix:**
1. Update all mocks to use `~/features/user` instead of `~/models/user.server`
2. Ensure Prisma is properly mocked for user queries
3. Use `vi.hoisted()` for Prisma mocks to ensure they're available before imports

**Example Fix:**
```typescript
// ❌ Bad
vi.mock("~/models/user.server", () => ({
  getUserById: vi.fn(),
}));

// ✅ Good
vi.mock("~/features/user", () => ({
  getUserById: vi.fn(),
}));
```

---

### Category 2: API Route Mocking with `vi.importActual` (6 tests)

#### Issue: Mocks not tracked when using `vi.importActual`
**Affected Tests:**
- `api-children.test.ts` (3 tests)
- `api-parent.test.ts` (3 tests)

**Root Cause:**
- Tests use `vi.importActual` to get real `loadChildrenData`/`loadParentData` functions
- These functions call `getUserBasicInfo`, `getUserSubscription`, etc.
- Mocks are set up but not tracked because real functions use real imports
- Real functions try to use Prisma which isn't properly mocked

**Best Practice Fix Options:**

**Option A: Mock the service functions directly (Recommended)**
```typescript
vi.mock("~/features/user/services/children-api.server", () => ({
  loadChildrenData: vi.fn(),
  handleChildrenApiError: vi.fn(),
}));
```

**Option B: Ensure Prisma is mocked and remove mock call assertions**
- Keep `vi.importActual` but ensure all dependencies are mocked
- Remove assertions about internal function calls
- Focus on response data validation

**Option C: Use partial mocks with `vi.importActual`**
```typescript
vi.mock("~/features/user", async () => {
  const actual = await vi.importActual("~/features/user");
  return {
    ...actual,
    getUserBasicInfo: vi.fn(),
    // ... other mocks
  };
});
```

**Recommended:** Option A - Mock at the service boundary for better isolation

---

### Category 3: Queue Worker Tests (11 tests)

#### Issue: User lookup failures
**Affected Tests:**
- All queue worker tests in `queue-workers.test.ts`
- Edge case tests in `queue-worker-edge-cases.test.ts`
- Queue operations tests in `queue-operations.test.ts`

**Root Cause:**
- Workers call `getUserById` from `~/features/user`
- Test mocks `~/models/user.server` which doesn't work
- Error: "User user-123 not found"

**Best Practice Fix:**
1. Update mock path: `~/models/user.server` → `~/features/user`
2. Ensure `getUserById` mock returns proper user object with required fields
3. Mock Prisma `user.findUnique` if needed

**Example:**
```typescript
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: TEST_USER_ID,
        npub: "npub123",
        userRelays: ["wss://relay1.com"],
        // ... other required fields
      }),
    },
    // ... other models
  };
  return { mockPrisma };
});

vi.mock("~/features/user", () => ({
  getUserById: vi.fn().mockResolvedValue({
    id: TEST_USER_ID,
    npub: "npub123",
    userRelays: ["wss://relay1.com"],
  }),
}));
```

---

### Category 4: Scheduling Algorithm Tests (2 tests)

#### Issue: Timing calculation and mock call tracking
**Affected Tests:**
- `scheduling-algorithms.test.ts`: "should use global interval when useGlobalInterval is true"
- `scheduling-algorithms.test.ts`: "should use first interval from scheduleIntervals array"

**Root Cause:**
1. `getScheduleInterval` mock not being called (test expects it)
2. Timing calculation mismatch (expected 1705316400000, got 1705320000000)
   - Difference: 3600000ms = 1 hour
   - Suggests timezone or calculation logic issue

**Best Practice Fix:**
1. Check if `getScheduleInterval` is actually called in the implementation
2. Review timing calculation logic - may need to account for timezone
3. Update test expectations to match actual behavior OR fix implementation
4. Consider using `vi.spyOn` to track calls if using `vi.importActual`

**Investigation Needed:**
- Check `calculateNextScheduleTime` implementation
- Verify timezone handling
- Check if `getScheduleInterval` is conditionally called

---

### Category 5: Recyclables Action Test (1 test file)

#### Issue: Entire test file failing
**Affected:**
- `recyclables-action.test.ts` - all tests

**Root Cause:**
- Need to check actual error message
- Likely similar to other issues: mock path or missing dependencies

**Best Practice Fix:**
1. Check if `handleRecyclablePostAction` is exported correctly
2. Verify all dependencies are mocked
3. Ensure Prisma is mocked if needed

---

### Category 6: Database Integration Test (1 test)

#### Issue: Requires real database
**Affected:**
- `database-integration.example.test.ts`

**Best Practice:**
- This is likely an example/integration test that requires a real database
- Consider:
  - Skipping in CI unless database is available
  - Using testcontainers or similar
  - Marking as `test.skip()` if not critical

---

## Best Practice Recommendations

### 1. Mock Strategy
- **Mock at service boundaries**, not internal implementation details
- **Use `vi.hoisted()`** for Prisma and other shared mocks
- **Avoid `vi.importActual`** when possible - prefer explicit mocks
- **Mock the module being tested** only if testing error handling

### 2. Module Path Consistency
- **Always use `~/features/*`** instead of deprecated `~/models/*.server`
- **Update all tests** to use new module paths
- **Document migration** in code comments

### 3. Prisma Mocking
```typescript
// ✅ Best Practice
const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {
      user: { findUnique: vi.fn(), findMany: vi.fn() },
      post: { findUnique: vi.fn(), update: vi.fn() },
      // ... all models used
    },
  };
});

vi.mock("~/lib/prisma.server", () => ({
  prisma: mockPrisma,
}));
```

### 4. Test Assertions
- **Focus on behavior, not implementation**
- **Test response data** rather than internal function calls
- **Use `expect.objectContaining()`** for partial matches
- **Remove assertions about internal calls** when using `vi.importActual`

### 5. Error Handling Tests
- **Mock error scenarios** explicitly
- **Test error responses**, not just success paths
- **Verify error messages** are user-friendly

---

## Implementation Priority

### Phase 1: Quick Wins (High Impact, Low Effort)
1. ✅ Fix module path mocks (`~/models/user.server` → `~/features/user`)
2. ✅ Fix queue worker tests (update getUserById mocks)
3. ✅ Fix recyclables-action test (check exports and mocks)

**Estimated Fixes**: ~11 tests

### Phase 2: API Route Tests (Medium Effort)
1. Refactor api-children/api-parent tests to mock service functions
2. Remove internal call assertions
3. Focus on response validation

**Estimated Fixes**: ~6 tests

### Phase 3: Algorithm Tests (Requires Investigation)
1. Investigate timing calculation logic
2. Fix timezone handling if needed
3. Update test expectations or implementation

**Estimated Fixes**: ~2 tests

### Phase 4: Database Test (Low Priority)
1. Mark as skip or configure test database
2. Document requirements

**Estimated Fixes**: ~1 test

---

## Testing Best Practices Checklist

- [ ] All mocks use correct module paths (`~/features/*`)
- [ ] Prisma is properly mocked with `vi.hoisted()`
- [ ] Tests focus on behavior, not implementation
- [ ] Error scenarios are tested
- [ ] No reliance on internal function call tracking
- [ ] Response data is validated, not just status codes
- [ ] Timezone handling is consistent
- [ ] Mock setup is clear and maintainable

---

## Next Steps

1. **Immediate**: Fix queue worker tests (Category 1)
2. **Short-term**: Refactor API route tests (Category 2)
3. **Medium-term**: Investigate scheduling algorithm (Category 4)
4. **Long-term**: Review and improve overall test architecture

