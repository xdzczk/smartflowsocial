# Error Handling Guide

This guide covers the centralized error handling system in SmartFlowSocial. The system provides type-safe, consistent error handling across the entire application.

## Overview

The error handling system consists of:

1. **Custom Error Classes** - Type-safe error types for different scenarios
2. **Error Handlers** - Utilities for handling errors in loaders and actions
3. **Error Logger** - Structured error logging
4. **Error Boundaries** - React error boundaries for UI errors
5. **Error Display** - Client-side error display components

## Quick Start

### Basic Usage in a Loader

```typescript
import { withErrorHandling } from "~/lib/error-handler.server";
import { assertExists } from "~/lib/error-handler.server";
import type { LoaderFunctionArgs } from "@remix-run/node";

export const loader = withErrorHandling(
  async ({ request, params }: LoaderFunctionArgs) => {
    const postId = params.postId;
    assertExists(postId, "Post ID is required");
    
    // Your loader logic here
    return { postId };
  }
);
```

### Basic Usage in an Action

```typescript
import { withActionErrorHandling, createSuccessResponse } from "~/lib/error-handler.server";
import { ValidationError } from "~/lib/errors";
import type { ActionFunctionArgs } from "@remix-run/node";

export const action = withActionErrorHandling(
  async ({ request }: ActionFunctionArgs) => {
    const formData = await request.formData();
    const email = formData.get("email");
    
    if (!email || typeof email !== "string") {
      throw new ValidationError("Email is required");
    }
    
    // Your action logic here
    return createSuccessResponse({ email });
  }
);
```

## Error Types

### Available Error Classes

| Error Class | Status Code | Use Case |
|------------|-------------|----------|
| `ValidationError` | 400 | Invalid input data |
| `AuthenticationError` | 401 | User not authenticated |
| `AuthorizationError` | 403 | User lacks permission |
| `NotFoundError` | 404 | Resource not found |
| `ConflictError` | 409 | Resource conflict (e.g., duplicate) |
| `RateLimitError` | 429 | Rate limit exceeded |
| `ExternalServiceError` | 502/503/504 | External API failures |
| `DatabaseError` | 500 | Database operation failures |
| `AppError` | 500 | Generic application errors |

### Creating Custom Errors

```typescript
import { AppError } from "~/lib/errors";

throw new ValidationError("Email is required", { field: "email" });
throw new NotFoundError("User not found", { userId: "123" });
throw new AuthorizationError("Insufficient permissions", { resource: "post" });
```

## Error Handling Patterns

### Pattern 1: Using Wrappers (Recommended)

The simplest approach - wrap your loader/action with error handling:

```typescript
export const loader = withErrorHandling(async ({ request, params }) => {
  // Your code here - errors are automatically caught and formatted
  return { data: "..." };
});
```

### Pattern 2: Manual Error Handling

For more control, handle errors manually:

```typescript
import { handleLoaderError, handleActionError } from "~/lib/error-handler.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    // Your code here
    return json({ data: "..." });
  } catch (error) {
    return handleLoaderError(error, { data: [] }); // Provide safe defaults
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    // Your code here
    return json({ success: true });
  } catch (error) {
    return handleActionError(error);
  }
}
```

### Pattern 3: Assertion Helpers

Use assertion helpers for common validations:

```typescript
import {
  assert,
  assertExists,
  assertAuthenticated,
  assertAuthorized,
} from "~/lib/error-handler.server";

// Assert a condition
assert(userId !== null, "User ID is required");

// Assert a value exists
const post = await getPost(postId);
assertExists(post, "Post not found", { postId });

// Assert user is authenticated
const userId = await getUserId(request);
assertAuthenticated(userId, "Please log in");

// Assert user has permission
const hasPermission = await checkPermission(userId, resource);
assertAuthorized(hasPermission, "Insufficient permissions");
```

## Error Responses

### Standard Error Response Format

All errors return a consistent format:

```json
{
  "success": false,
  "error": {
    "message": "User-friendly error message",
    "code": "VALIDATION_ERROR",
    "statusCode": 400,
    "timestamp": "2024-01-01T00:00:00.000Z",
    "context": {
      "field": "email"
    }
  }
}
```

### Success Response Format

```json
{
  "success": true,
  "data": {
    // Your data here
  }
}
```

## Client-Side Error Handling

### Displaying Errors in Components

```typescript
import { ErrorDisplay, showErrorToast } from "~/components/ErrorDisplay";
import { useActionData } from "@remix-run/react";

export default function MyComponent() {
  const actionData = useActionData();
  
  // Show error as toast
  if (actionData?.error) {
    showErrorToast(actionData.error);
  }
  
  // Or display inline
  return (
    <div>
      {actionData?.error && (
        <ErrorDisplay error={actionData.error} variant="alert" />
      )}
    </div>
  );
}
```

## Error Logging

Errors are automatically logged with structured output:

- **Development**: Human-readable console output
- **Production**: JSON format for log aggregation

### Log Context

You can add context to error logs:

```typescript
import { logError } from "~/lib/error-logger.server";

try {
  // Your code
} catch (error) {
  logError(normalizeError(error), {
    userId: user.id,
    path: request.url,
    method: request.method,
  });
  throw error;
}
```

## Error Boundaries

The root `ErrorBoundary` component automatically catches:

- Errors thrown in loaders
- Errors thrown in actions
- Errors thrown in React components

Customize the error boundary in `app/root.tsx`.

## Best Practices

### 1. Use Specific Error Types

```typescript
// ✅ Good
throw new ValidationError("Email is required");

// ❌ Bad
throw new Error("Email is required");
```

### 2. Provide Context

```typescript
// ✅ Good
throw new NotFoundError("Post not found", { postId, userId });

// ❌ Bad
throw new NotFoundError("Post not found");
```

### 3. Use Assertion Helpers

```typescript
// ✅ Good
assertExists(post, "Post not found", { postId });

// ❌ Bad
if (!post) {
  throw new NotFoundError("Post not found");
}
```

### 4. Handle External Service Errors

```typescript
try {
  const response = await fetch("https://api.example.com/data");
  if (!response.ok) {
    throw new ExternalServiceError(
      "Failed to fetch data",
      response.status,
      { status: response.status }
    );
  }
} catch (error) {
  if (error instanceof ExternalServiceError) {
    throw error;
  }
  throw new ExternalServiceError("Unexpected error", 502);
}
```

### 5. Don't Expose Internal Errors

The system automatically hides internal errors in production:

```typescript
// In production, users see: "An unexpected error occurred"
// In development, users see the full error message
```

## Migration Guide

### Migrating Existing Routes

**Before:**
```typescript
export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const postId = params.postId;
    if (!postId) {
      return json({ error: "Post ID required" }, { status: 400 });
    }
    // ...
  } catch (error) {
    console.error("Error:", error);
    return json({ error: "An error occurred" }, { status: 500 });
  }
}
```

**After:**
```typescript
export const loader = withErrorHandling(
  async ({ request, params }: LoaderFunctionArgs) => {
    const postId = params.postId;
    assertExists(postId, "Post ID is required");
    // ...
  }
);
```

## Integration with External Services

### Sentry Integration (Example)

To integrate with Sentry or other error tracking services, update `app/lib/error-logger.server.ts`:

```typescript
import * as Sentry from "@sentry/remix";

export function logError(error: AppError | Error, context: LogContext = {}) {
  // ... existing logging code ...
  
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error, {
      tags: { code: isAppError(error) ? error.code : "UNKNOWN" },
      extra: context,
    });
  }
}
```

## Type Safety

All error handling is fully type-safe:

```typescript
import type { ErrorResponse, SuccessResponse } from "~/lib/error-handler.server";

function handleResponse(response: ErrorResponse | SuccessResponse<Data>) {
  if (response.success) {
    // TypeScript knows this is SuccessResponse<Data>
    console.log(response.data);
  } else {
    // TypeScript knows this is ErrorResponse
    console.log(response.error.message);
  }
}
```

## Troubleshooting

### Error Not Being Caught

Make sure you're using the error handling wrapper or manually catching errors:

```typescript
// ✅ Will be caught
export const loader = withErrorHandling(async () => {
  throw new ValidationError("Error");
});

// ❌ Won't be caught automatically
export async function loader() {
  throw new ValidationError("Error"); // Must wrap or catch manually
}
```

### Errors Not Logging

Check that errors are being normalized:

```typescript
import { normalizeError } from "~/lib/errors";
import { logError } from "~/lib/error-logger.server";

try {
  // ...
} catch (error) {
  const normalized = normalizeError(error);
  logError(normalized, { /* context */ });
  throw normalized;
}
```

## See Also

- [Error Handler Example](./app/lib/error-handler.example.ts) - Complete examples
- [Error Classes](./app/lib/errors.ts) - All error types
- [Error Handler Utilities](./app/lib/error-handler.server.ts) - Helper functions
- [Error Metrics Guide](./ERROR_METRICS.md) - Error tracking and monitoring

