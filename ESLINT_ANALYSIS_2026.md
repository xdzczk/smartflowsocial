# ESLint Analysis - Current State After E2E Test Expansion

**Date:** 2026-01-01  
**Status:** Analysis complete, fix plan ready

## 📊 Current ESLint Status

### Production Code
- **Errors:** 0 ✅
- **Warnings:** 0 ✅
- **Files with issues:** 0
- **Status:** 🟢 **Perfect!**

### Test/Script Files
- **Errors:** 237
- **Warnings:** 185
- **Files with issues:** 97
- **Status:** 🔴 **Needs fixing**

**Total Issues:** 422 (237 errors + 185 warnings)

---

## 🔍 Error Breakdown by Type

### Top 10 Error Types:

| Rank | Error Type | Count | % of Total | Priority | Auto-fixable |
|------|-----------|-------|------------|----------|--------------|
| 1 | `@typescript-eslint/consistent-type-assertions` | 108 | 45.6% | Medium | Partial |
| 2 | `@typescript-eslint/no-unsafe-assignment` | 59 | 24.9% | High | No |
| 3 | `@typescript-eslint/no-floating-promises` | 15 | 6.3% | High | No |
| 4 | `@typescript-eslint/no-misused-promises` | 13 | 5.5% | High | No |
| 5 | `@typescript-eslint/restrict-template-expressions` | 11 | 4.6% | Medium | No |
| 6 | `@typescript-eslint/no-unsafe-member-access` | 11 | 4.6% | High | No |
| 7 | `@typescript-eslint/no-unsafe-call` | 8 | 3.4% | High | No |
| 8 | `@typescript-eslint/no-unused-vars` | 5 | 2.1% | Low | Partial |
| 9 | `cypress/unsafe-to-chain-command` | 3 | 1.3% | Medium | No |
| 10 | `@typescript-eslint/parser` | 1 | 0.4% | High | No |

**Total:** 237 errors

---

## 📁 Error Distribution by File Type

### E2E Test Files (21 files)
- **Errors in e2e tests:** ~50-60 errors
- **Main issues:**
  - Template expressions (11 errors)
  - Unsafe operations (20-30 errors)
  - Unsafe chaining (3 errors)
  - Parser error (1 error)

### Integration Test Files
- **Errors:** ~100-120 errors
- **Main issues:**
  - Type assertions (60-70 errors)
  - Unsafe assignments (30-40 errors)
  - Floating promises (10-15 errors)

### Other Test Files
- **Errors:** ~60-70 errors
- **Main issues:**
  - Type assertions (40-50 errors)
  - Unsafe operations (20-30 errors)

---

## 🎯 Fix Strategy

### Phase 1: Critical Fixes (High Priority) - 2-3 hours

**Goal:** Fix errors that can cause runtime issues or block other fixes

#### 1.1 Parser Error (1 error) - **START HERE**
**File:** Likely in e2e tests
**Issue:** `tests/e2e/tsconfig.json` doesn't support type-aware parsing
**Fix:** Either add proper project configuration or disable type-aware parsing for e2e tests

**Solution Options:**
```typescript
// Option 1: Disable type-aware parsing for e2e (simpler)
// In eslint.config.mjs, remove parserOptions.project for e2e tests

// Option 2: Fix tsconfig.json to support project references
// Add "references" field to e2e tsconfig.json
```

#### 1.2 Floating Promises (15 errors)
**Impact:** Can cause flaky tests
**Files:** `commands.ts`, `seed-test-db.ts`, other test files

**Fix Pattern:**
```typescript
// ❌ Error
cy.exec(`command`);

// ✅ Fix
void cy.exec(`command`); // Fire-and-forget
// or
cy.exec(`command`).then(() => { /* continue */ });
```

#### 1.3 Unsafe Operations (78 errors total)
- Unsafe assignments: 59 errors
- Unsafe member access: 11 errors
- Unsafe calls: 8 errors

**Fix Pattern:**
```typescript
// Unsafe assignment
const value: string = anyValue as string;

// Unsafe member access
const name = (anyValue as { name: string }).name;

// Unsafe call
(anyFunction as () => void)();
```

**Expected Result:** ~94 errors fixed

---

### Phase 2: Type Assertion Style (108 errors) - 4-5 hours

**Priority:** Medium (code style, not runtime issues)

**Fix Pattern:**
```typescript
// ❌ Error
const data = { id: 1 } as MyType;

// ✅ Fix
const data: MyType = { id: 1 };
```

**Note:** This is mechanical but time-consuming. Can be done incrementally.

**Expected Result:** ~108 errors fixed

---

### Phase 3: Template Expressions & Misc (35 errors) - 1-2 hours

#### 3.1 Template Expressions (11 errors)
**Fix Pattern:**
```typescript
// ❌ Error
const msg = `Value: ${unknownValue}`;

// ✅ Fix
const msg = `Value: ${String(unknownValue)}`;
```

#### 3.2 Cypress Unsafe Chaining (3 errors)
**Fix Pattern:**
```typescript
// ❌ Error
cy.get("body").then(($body) => {
  cy.wrap($body.find("button")).click();
});

// ✅ Fix
cy.get("body").then(($body) => {
  const button = $body.find("button");
  if (button.length > 0) {
    cy.wrap(button).click();
  }
});
```

#### 3.3 Unused Variables (5 errors)
**Fix:** Remove or prefix with `_`

**Expected Result:** ~19 errors fixed

---

## 📝 File-by-File Priority

### 🔴 Critical Priority (Fix First)

1. **`tests/e2e/support/commands.ts`**
   - Floating promises: ~5-8 errors
   - Unsafe operations: ~3-5 errors
   - Template expressions: ~2-3 errors
   - Unsafe chaining: ~1-2 errors
   - **Total:** ~11-18 errors
   - **Why:** Most used file, affects all e2e tests

2. **Files with parser errors**
   - Parser error: 1 error
   - **Why:** Blocks type-aware linting

3. **`tests/database/seed-test-db.ts`**
   - Floating promises: ~1-2 errors
   - **Why:** Used in test setup

### 🟡 High Priority

4. **E2E test files** (`tests/e2e/*.cy.ts`)
   - Template expressions: ~8-10 errors
   - Unsafe operations: ~15-20 errors
   - **Total:** ~25-30 errors

5. **Integration test files** (`tests/integration/*.test.ts`)
   - Type assertions: ~60-70 errors
   - Unsafe assignments: ~30-40 errors
   - Floating promises: ~10-15 errors
   - **Total:** ~100-125 errors

### 🟢 Medium Priority

6. **Type assertion fixes** (all test files)
   - Can be done incrementally
   - ~108 errors total

---

## 🛠️ Quick Fixes

### Fix 1: Parser Error
The e2e tsconfig.json needs to either:
- Extend the main tsconfig.json, or
- Have ESLint disable type-aware parsing for e2e tests

**Recommended:** Disable type-aware parsing for e2e tests since they're Cypress tests and don't need it.

### Fix 2: Floating Promises in commands.ts
```typescript
// Line 126, 143, 194, 199, etc.
// Before
cy.exec(`command`).then(...)

// After
void cy.exec(`command`).then(...)
```

### Fix 3: Unsafe cy.state Access
```typescript
// Line 177
// Before
const aliases = (cy as any).state("aliases") ?? {};

// After
interface CypressState {
  state: (key: string) => unknown;
}
const aliases = ((cy as unknown) as CypressState).state("aliases") as Record<string, unknown> ?? {};
```

### Fix 4: Template Expressions
```typescript
// Multiple files
// Before
const msg = `Value: ${unknownValue}`;

// After
const msg = `Value: ${String(unknownValue)}`;
```

---

## 📊 Progress Tracking

**Starting Point:**
- Errors: 237
- Warnings: 185
- Total: 422

**Target:**
- Errors: 0
- Warnings: <50 (acceptable for tests)

**Milestones:**
- [ ] Phase 1 Complete: ~94 errors fixed (143 remaining)
- [ ] Phase 2 Complete: ~108 errors fixed (35 remaining)
- [ ] Phase 3 Complete: ~19 errors fixed (16 remaining)
- [ ] Final cleanup: All errors fixed

---

## 🚀 Recommended Workflow

1. **Fix parser error first** (blocks other fixes)
2. **Fix commands.ts** (highest impact, most used)
3. **Fix floating promises** (prevents flaky tests)
4. **Fix unsafe operations** (improves type safety)
5. **Fix type assertions** (mechanical, can batch)
6. **Fix remaining issues** (template expressions, etc.)

---

## ⏱️ Time Estimates

- **Phase 1 (Critical):** 2-3 hours
- **Phase 2 (Type Assertions):** 4-5 hours
- **Phase 3 (Misc):** 1-2 hours

**Total:** 7-10 hours

---

## 📚 Related Documents

- **ESLINT_FIX_PLAN_2026.md** - Detailed fix plan with examples
- **ESLINT_STATUS.md** - Current status summary
- **ESLINT_STRICT_MODE_ANALYSIS.md** - Analysis of strict mode changes

---

**Status:** ✅ Analysis complete. Ready to start fixing!

