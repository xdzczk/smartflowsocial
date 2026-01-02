# withErrorHandling Bundling Issue

## Problem

The `withErrorHandling` and `withActionErrorHandling` functions are `undefined` at runtime, causing routes to crash with:
```
TypeError: (0 , import_error_handler.withErrorHandling) is not a function
```

## Root Cause

Remix's bundler uses lazy ESM initialization (`__esm` pattern). The export getter `() => withErrorHandling` is created before the function is assigned inside the init function. When routes try to use it, the variable is still `undefined`.

### Evidence from Build Output

```javascript
// Line 474: Export getter created
withErrorHandling: () => withErrorHandling

// Line 502: Function assigned (inside init function)
function withErrorHandling(loaderFn) { ... }
```

The getter references `withErrorHandling` before it's assigned.

## Attempted Fixes

1. ✅ Changed `export const` to `export function` - Still uses getter pattern
2. ✅ Added to `sideEffects` in `package.json` - Doesn't help with lazy init
3. ✅ Function declaration vs const - Bundler still uses lazy init

## Current Status

The bundler's lazy ESM initialization cannot be easily overridden. The export getter pattern is hardcoded.

## Potential Solutions

### Option 1: Use Dynamic Imports (Works, but requires route changes)

Routes that use dynamic imports work:
```typescript
// ✅ This works
export async function action({ request }: ActionFunctionArgs) {
  try {
    // ... code
  } catch (error) {
    const { handleActionError } = await import("~/lib/error-handler.server");
    return handleActionError(error);
  }
}
```

But static imports fail:
```typescript
// ❌ This fails
import { withErrorHandling } from "~/lib/error-handler.server";
export const loader = withErrorHandling(loaderImpl);
```

### Option 2: Remove Wrapper, Use Direct Error Handling

Instead of wrapping loaders/actions, handle errors directly:
```typescript
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // ... loader code
    return json(data);
  } catch (error) {
    const { handleLoaderError } = await import("~/lib/error-handler.server");
    return handleLoaderError(error);
  }
}
```

### Option 3: Force Synchronous Initialization

Try to force the module to initialize synchronously by:
- Adding a side-effect at module level
- Using a different export pattern
- Modifying Remix bundler config (if possible)

### Option 4: Use Different Utility Pattern

Create a factory function that routes call:
```typescript
// In error-handler.server.ts
export async function createLoaderWithErrorHandling<T>(
  loaderFn: (args: LoaderFunctionArgs) => Promise<T>
) {
  return async (args: LoaderFunctionArgs) => {
    // ... error handling
  };
}

// In routes
export const loader = createLoaderWithErrorHandling(loaderImpl);
```

## Recommendation

Given that:
1. Dynamic imports work
2. `handleLoaderError` and `handleActionError` work with dynamic imports
3. Many routes already use try/catch with dynamic imports

**Recommendation**: Update routes to use dynamic imports for error handling instead of the wrapper pattern. This is more explicit and avoids the bundling issue entirely.

## Next Steps

1. Test if dynamic imports work in all route contexts
2. If yes, update routes to use dynamic imports
3. If no, investigate Option 3 (force synchronous init) or Option 4 (factory pattern)

