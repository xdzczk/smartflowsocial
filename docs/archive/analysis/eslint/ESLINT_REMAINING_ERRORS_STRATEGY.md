# Strategy for Remaining ESLint Errors

**Date:** 2026-01-01  
**Status:** 27 errors remaining (89% fixed - 210/237)  
**Last Updated:** 2026-01-01

## Overview

After fixing 210 errors (89% reduction), we have **27 errors remaining**. These fall into three main categories, each requiring a different approach.

---

## Error Breakdown

### 1. Unsafe Assignment Errors (12 errors)
**Rule:** `@typescript-eslint/no-unsafe-assignment`  
**Location:** Test files using `expect.objectContaining()`

**Why they exist:**
- `expect.objectContaining()` returns `any` type by design (Jest/Vitest limitation)
- These are intentional partial matches in test assertions
- Common pattern: `expect(mockCall).toHaveBeenCalledWith(expect.objectContaining({ ... }))`

**Best Approach:**
✅ **Option A: ESLint Disable Comments (Recommended)**
- Add `// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment` above each usage
- **Pros:** Explicit, documents intentional usage, maintains type safety elsewhere
- **Cons:** Adds comments to code
- **Time:** ~15 minutes

✅ **Option B: Rule Exception for Test Files**
- Modify `eslint.config.mjs` to allow unsafe assignments in test files when using `expect.objectContaining`
- **Pros:** Clean code, no comments needed
- **Cons:** Reduces type safety for all test files
- **Time:** ~5 minutes

**Recommendation:** **Option A** - More explicit and maintains stricter type checking for other test code.

---

### 2. Import Order Errors (8 errors)
**Rule:** `import/order`  
**Location:** Files with `vi.mock()` calls

**Why they exist:**
- Some imports must come AFTER `vi.mock()` calls (dynamic imports)
- ESLint doesn't understand Vitest's hoisting behavior
- Example: `import { getBitcoinRate } from "~/features/payments/btc.rate";` after `vi.mock("~/features/payments/btc.rate")`

**Best Approach:**
✅ **Option A: ESLint Disable Comments (Recommended)**
- Add `// eslint-disable-next-line import/order` for intentional post-mock imports
- **Pros:** Documents intentional pattern, maintains import ordering elsewhere
- **Cons:** Adds comments
- **Time:** ~10 minutes

✅ **Option B: Configure Import Order Rules**
- Modify `eslint.config.mjs` to allow imports after `vi.mock()` in test files
- **Pros:** Clean code
- **Cons:** Complex configuration, may miss real import order issues
- **Time:** ~30 minutes

**Recommendation:** **Option A** - Clearer intent and easier to maintain.

---

### 3. Other Errors (7 errors)
**Rules:** Various (parsing errors, edge cases)

**Categories:**
- Parsing errors (e.g., `cypress.config.mobile.ts` - already handled with ignores)
- Edge case type assertions
- Unknown/other

**Best Approach:**
✅ **Fix Individually**
- Review each error case-by-case
- Most can be fixed with proper type assertions or ESLint disable comments
- **Time:** ~20-30 minutes

---

## Recommended Action Plan

### Phase 3: Clean Up Remaining Errors (1-2 hours)

1. **Fix Unsafe Assignments (15 min)**
   ```bash
   # Find all expect.objectContaining usages
   grep -r "expect.objectContaining" tests/ --include="*.ts" --include="*.tsx"
   ```
   - Add ESLint disable comments above each usage
   - Document why in comment: `// expect.objectContaining returns 'any' - acceptable for test mocks`

2. **Fix Import Order (10 min)**
   ```bash
   # Find import order errors
   pnpm lint 2>&1 | grep "import/order"
   ```
   - Add ESLint disable comments for intentional post-mock imports
   - Document: `// Import after vi.mock() for dynamic import pattern`

3. **Fix Other Errors (30 min)**
   - Review each error individually
   - Apply appropriate fix (type assertion, disable comment, or code refactor)

### Alternative: Accept Current State

If time is limited, the remaining 27 errors are:
- ✅ **Non-critical** - All in test files, not production code
- ✅ **Acceptable patterns** - Common testing patterns (`expect.objectContaining`)
- ✅ **Intentional** - Some are by design (post-mock imports)

**You could:**
- Add a note in `ESLINT_STATUS.md` explaining why these are acceptable
- Set a lower priority for fixing them
- Focus on preventing new errors instead

---

## Code Examples

### Fixing Unsafe Assignment

**Before:**
```typescript
expect(mockPrisma.post.create).toHaveBeenCalledWith(
  expect.objectContaining({
    data: expect.objectContaining({
      content: "Test content",
    }),
  }),
);
```

**After:**
```typescript
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
expect(mockPrisma.post.create).toHaveBeenCalledWith(
  expect.objectContaining({
    data: expect.objectContaining({
      content: "Test content",
    }),
  }),
);
```

### Fixing Import Order

**Before:**
```typescript
vi.mock("~/features/payments/btc.rate", () => ({
  getBitcoinRate: vi.fn(),
}));

import { getBitcoinRate } from "~/features/payments/btc.rate"; // Error: should be before mock
```

**After:**
```typescript
vi.mock("~/features/payments/btc.rate", () => ({
  getBitcoinRate: vi.fn(),
}));

// eslint-disable-next-line import/order
// Import after vi.mock() for dynamic import pattern
import { getBitcoinRate } from "~/features/payments/btc.rate";
```

---

## Decision Matrix

| Error Type | Count | Fix Time | Priority | Recommendation |
|------------|-------|----------|----------|----------------|
| Unsafe Assignment | 12 | 15 min | Medium | Fix with disable comments |
| Import Order | 8 | 10 min | Medium | Fix with disable comments |
| Other | 7 | 30 min | Low | Fix individually or accept |

**Total Fix Time:** ~1 hour  
**Alternative:** Accept current state (27 errors is excellent for a large test suite)

---

## Conclusion

**Best Approach:** Fix the remaining errors with ESLint disable comments where appropriate. This:
- ✅ Documents intentional patterns
- ✅ Maintains code quality
- ✅ Takes only ~1 hour
- ✅ Gets to 100% error-free

**Alternative:** Accept current state if time-constrained. 27 errors (89% fixed) is excellent, and all remaining errors are in test files with acceptable patterns.


