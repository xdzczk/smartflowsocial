# ESLint Fix Plan for Production Code

**Current Status:** 57 errors + 588 warnings = 645 total issues in production code

## Priority Levels

### 🔴 **Priority 1: Critical Errors (57 errors)**
These must be fixed as they indicate actual bugs or unsafe code patterns.

### 🟡 **Priority 2: High-Impact Warnings (129 + 112 = 241 warnings)**
These are code quality issues that should be addressed.

### 🟢 **Priority 3: Low-Impact Warnings (347 warnings)**
These are style/preference issues that can be addressed gradually.

---

## Priority 1: Critical Errors (57 errors)

### 1. React Hooks Rules (9 errors)
**Rule:** `react-hooks/rules-of-hooks`
**Impact:** High - Can cause runtime bugs
**Fix Strategy:**
- Ensure hooks are called at the top level of components
- Never call hooks conditionally or in loops
- Check for hooks called in event handlers or callbacks

**Example fixes:**
```typescript
// ❌ Bad
if (condition) {
  useEffect(() => {}, []);
}

// ✅ Good
useEffect(() => {
  if (condition) {
    // do something
  }
}, [condition]);
```

### 2. Template Expression Safety (8 errors)
**Rule:** `@typescript-eslint/restrict-template-expressions`
**Impact:** Medium - Type safety
**Fix Strategy:**
- Wrap `any` values in template strings with `String()` or type guards
- Use nullish coalescing for potentially undefined values

**Example fixes:**
```typescript
// ❌ Bad
const message = `Value: ${value}`; // value is any

// ✅ Good
const message = `Value: ${String(value ?? '')}`;
```

### 3. Explicit Any (8 errors)
**Rule:** `@typescript-eslint/no-explicit-any`
**Impact:** Medium - Type safety
**Fix Strategy:**
- Replace `any` with proper types
- Use `unknown` if type is truly unknown, then add type guards
- Use generic types where appropriate

**Example fixes:**
```typescript
// ❌ Bad
function process(data: any) { }

// ✅ Good
function process<T>(data: T) { }
// or
function process(data: unknown) {
  if (typeof data === 'string') {
    // process string
  }
}
```

### 4. Unsafe Assignments (7 errors)
**Rule:** `@typescript-eslint/no-unsafe-assignment`
**Impact:** High - Type safety
**Fix Strategy:**
- Add proper type annotations
- Use type assertions with caution
- Add runtime type validation where needed

### 5. Unsafe Member Access (7 errors)
**Rule:** `@typescript-eslint/no-unsafe-member-access`
**Impact:** High - Runtime safety
**Fix Strategy:**
- Use optional chaining (`?.`)
- Add type guards before accessing properties
- Use proper typing instead of `any`

**Example fixes:**
```typescript
// ❌ Bad
const value = data.property; // data is any

// ✅ Good
const value = data?.property;
// or
if (data && typeof data === 'object' && 'property' in data) {
  const value = data.property;
}
```

### 6. Unsafe Calls (6 errors)
**Rule:** `@typescript-eslint/no-unsafe-call`
**Impact:** High - Runtime safety
**Fix Strategy:**
- Type function parameters properly
- Use type guards before calling functions
- Avoid calling functions on `any` types

### 7. Constant Binary Expression (3 errors)
**Rule:** `no-constant-binary-expression`
**Impact:** Low - Logic bugs
**Fix Strategy:**
- Fix comparisons that always evaluate to true/false
- Check for typos in comparisons

**Example fixes:**
```typescript
// ❌ Bad
if (x === x) { } // always true

// ✅ Good
if (x === y) { }
```

### 8. Floating Promises (3 errors)
**Rule:** `@typescript-eslint/no-floating-promises`
**Impact:** Medium - Async bugs
**Fix Strategy:**
- Add `await` if result is needed
- Use `void` for fire-and-forget promises
- Handle errors appropriately

**Example fixes:**
```typescript
// ❌ Bad
someAsyncFunction();

// ✅ Good
await someAsyncFunction();
// or
void someAsyncFunction();
```

### 9. Import Order (2 errors)
**Rule:** `import/order`
**Impact:** Low - Code style
**Fix Strategy:**
- Run `pnpm lint:fix` - this is auto-fixable
- Ensure imports are grouped: external → internal → relative

### 10. Type Assertions (2 errors)
**Rule:** `@typescript-eslint/consistent-type-assertions`
**Impact:** Low - Code style
**Fix Strategy:**
- Use `as` syntax consistently
- Prefer type annotations over assertions where possible

### 11. Misused Promises (2 errors)
**Rule:** `@typescript-eslint/no-misused-promises`
**Impact:** Medium - Async bugs
**Fix Strategy:**
- Wrap async functions in event handlers with `void`
- Use proper async handlers

**Example fixes:**
```typescript
// ❌ Bad
onClick={asyncFunction}

// ✅ Good
onClick={() => { void asyncFunction(); }}
```

---

## Priority 2: High-Impact Warnings (241 warnings)

### 1. Feature Boundary Violations (301 warnings)
**Rule:** `import/no-restricted-paths`
**Impact:** Medium - Architecture
**Fix Strategy:**
- Refactor imports to use feature public APIs (index.ts)
- Create/update feature index files
- Move shared code to appropriate locations

**Note:** This is the largest category but may require architectural changes. Consider:
- Creating feature index files if missing
- Reviewing import patterns
- Potentially relaxing some rules if boundaries are intentionally crossed

### 2. Prefer Nullish Coalescing (129 warnings)
**Rule:** `@typescript-eslint/prefer-nullish-coalescing`
**Impact:** Low - Code quality
**Fix Strategy:**
- Replace `||` with `??` where appropriate
- Run auto-fix script: `pnpm lint:fix`

**Example fixes:**
```typescript
// ❌ Bad
const value = data || 'default';

// ✅ Good
const value = data ?? 'default';
```

### 3. Unused Variables (112 warnings)
**Rule:** `@typescript-eslint/no-unused-vars`
**Impact:** Low - Code cleanliness
**Fix Strategy:**
- Remove unused variables
- Prefix with `_` if intentionally unused
- Use rest parameters to ignore unused values

**Example fixes:**
```typescript
// ❌ Bad
const unused = getValue();

// ✅ Good
const _unused = getValue(); // or remove it
```

---

## Priority 3: Low-Impact Warnings (347 warnings)

- `no-restricted-imports` (18) - Import restrictions
- `@typescript-eslint/consistent-type-imports` (9) - Import style
- `@typescript-eslint/prefer-optional-chain` (7) - Code style
- `jsx-a11y/*` (8) - Accessibility warnings
- `react-hooks/exhaustive-deps` (4) - Hook dependencies

---

## Recommended Fix Order

### Phase 1: Quick Wins (Auto-fixable)
1. Run `pnpm lint:fix` to auto-fix:
   - Import order (2 errors)
   - Some nullish coalescing (129 warnings)
   - Some unused variables

**Estimated time:** 5 minutes

### Phase 2: Type Safety Errors (Manual fixes)
1. Fix React Hooks violations (9 errors)
2. Fix template expressions (8 errors)
3. Fix unsafe assignments/access/calls (20 errors)
4. Fix explicit any (8 errors)

**Estimated time:** 2-4 hours

### Phase 3: Async/Promise Errors
1. Fix floating promises (3 errors)
2. Fix misused promises (2 errors)

**Estimated time:** 30 minutes

### Phase 4: Remaining Errors
1. Constant binary expressions (3 errors)
2. Type assertions (2 errors)

**Estimated time:** 15 minutes

### Phase 5: High-Impact Warnings
1. Address unused variables (112 warnings)
2. Review feature boundary violations (301 warnings) - may need architectural decisions

**Estimated time:** 4-8 hours

### Phase 6: Low-Impact Warnings
1. Code style improvements
2. Accessibility improvements

**Estimated time:** Ongoing

---

## Tools and Scripts

### Available Scripts
- `pnpm lint` - Check for errors (auto-updates eslint-report.json)
- `pnpm lint:fix` - Auto-fix what's possible
- `node scripts/analyze-eslint-errors.js` - See breakdown by location
- `node scripts/analyze-error-types.js` - See breakdown by error type

### Recommended Workflow
1. Run `pnpm lint:fix` first
2. Check remaining errors: `node scripts/analyze-error-types.js`
3. Fix errors file by file, starting with highest error count
4. Re-run `pnpm lint` after each batch of fixes
5. Track progress with the analysis scripts

---

## Success Metrics

- **Target:** 0 errors in production code
- **Current:** 57 errors
- **Progress tracking:** Run `node scripts/analyze-eslint-errors.js` after each fix session

---

## Notes

- Most warnings (301) are feature boundary violations - these may require architectural review
- Many issues can be auto-fixed with `pnpm lint:fix`
- Focus on errors first, then high-impact warnings
- Test/script files have relaxed rules, so focus on production code

