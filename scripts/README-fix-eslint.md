# ESLint Auto-Fix Script

This script automatically fixes common ESLint errors in the codebase.

## Usage

```bash
npm run lint:fix
```

Or directly:

```bash
node scripts/fix-eslint-errors.js
```

## What It Does

The script performs the following fixes:

1. **ESLint Auto-Fix**: Runs `eslint --fix` to automatically fix issues that ESLint can handle (including import order)
2. **Nullish Coalescing**: Replaces `||` with `??` in safe contexts (e.g., `value?.prop || fallback` → `value?.prop ?? fallback`)
3. **Remove Unnecessary Async**: Removes `async` keyword from functions that don't use `await`

**Note**: Import order is handled by ESLint's built-in `--fix` rather than custom logic to ensure compatibility with ESLint's sophisticated grouping and alphabetization rules.

## Limitations

The script focuses on **safe, automatic fixes**. Some errors may require manual intervention:

- Complex type assertions
- Unsafe `any` assignments that need proper typing
- Promise handling in event handlers (may need `void` wrapper)
- Import path restrictions (feature boundaries)

## After Running

After the script completes, check remaining errors:

```bash
npm run lint
```

The script will report how many errors and warnings remain.

