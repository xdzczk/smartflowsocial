# API Development Guide

**Estimated time:** 30 minutes  
**Difficulty:** Intermediate  
**Last updated:** 2026-01-02

Guide for building and maintaining API endpoints in SmartFlowSocial.

---

## Table of Contents

- [Overview](#overview)
- [API Structure](#api-structure)
- [Creating Endpoints](#creating-endpoints)
- [Request Handling](#request-handling)
- [Response Formatting](#response-formatting)
- [Error Handling](#error-handling)
- [Authentication](#authentication)
- [Validation](#validation)
- [Testing](#testing)
- [Best Practices](#best-practices)

---

## Overview

SmartFlowSocial API endpoints are located in `app/routes/api.*.tsx`. These endpoints handle:

- File uploads
- Post publishing
- Queue management
- User operations
- External data fetching

### API Design Principles

- **RESTful where applicable** - Use standard HTTP methods
- **JSON request/response** - Consistent JSON format
- **Consistent error handling** - Standard error responses
- **Authentication required** - Most endpoints require auth

---

## API Structure

### File Naming

API routes follow Remix file-based routing:

```
app/routes/
├── api.upload.tsx              # POST /api/upload
├── api.publish.tsx              # POST /api/publish
├── api.queue-schedule.tsx      # GET /api/queue-schedule
└── api.effective-hashtags.tsx  # GET /api/effective-hashtags
```

### Route Pattern

```typescript
// app/routes/api.example.tsx
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { requireUserId } from "~/features/auth";

// GET requests
export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  // Handle GET request
  return json({ data: "..." });
}

// POST/PUT/DELETE requests
export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  // Handle mutation
  return json({ success: true });
}
```

---

## Creating Endpoints

### Basic Endpoint

```typescript
// app/routes/api.example.tsx
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { requireUserId } from "~/features/auth";

export async function loader({ request }: LoaderFunctionArgs) {
  // 1. Authenticate
  const userId = await requireUserId(request);

  // 2. Parse query parameters
  const url = new URL(request.url);
  const param = url.searchParams.get("param");

  // 3. Validate input
  if (!param) {
    return json({ error: "Param required" }, { status: 400 });
  }

  // 4. Process request
  const data = await processRequest(userId, param);

  // 5. Return response
  return json({ data });
}
```

### POST Endpoint

```typescript
// app/routes/api.example.tsx
import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { requireUserId } from "~/features/auth";
import { ValidationError } from "~/lib/errors";

export async function action({ request }: ActionFunctionArgs) {
  // 1. Authenticate
  const userId = await requireUserId(request);

  // 2. Parse request body
  const body = await request.json();

  // 3. Validate input
  if (!body.field) {
    throw new ValidationError("Field required");
  }

  // 4. Process request
  const result = await processMutation(userId, body);

  // 5. Return response
  return json({ success: true, data: result });
}
```

---

## Request Handling

### Query Parameters

```typescript
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const param1 = url.searchParams.get("param1");
  const param2 = url.searchParams.get("param2");

  // Handle parameters
}
```

### Request Body

```typescript
export async function action({ request }: ActionFunctionArgs) {
  // JSON body
  const body = await request.json();

  // Form data
  const formData = await request.formData();
  const field = formData.get("field");
}
```

### File Uploads

```typescript
export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return json({ error: "File required" }, { status: 400 });
  }

  // Upload file
  const url = await uploadFile(file, userId);

  return json({ url });
}
```

---

## Response Formatting

### Success Response

```typescript
// Simple data
return json({ data: result });

// With metadata
return json({
  data: result,
  meta: {
    count: result.length,
    page: 1,
  },
});
```

### Error Response

```typescript
// Validation error
return json({ error: "Invalid input" }, { status: 400 });

// Not found
return json({ error: "Resource not found" }, { status: 404 });

// Server error
return json({ error: "Internal server error" }, { status: 500 });
```

### Custom Error Classes

```typescript
import { ValidationError, NotFoundError } from "~/lib/errors";

// Throw errors (handled by error boundary)
throw new ValidationError("Invalid input");
throw new NotFoundError("Resource not found");
```

---

## Error Handling

### Error Hierarchy

```typescript
Error (base)
├── ValidationError (400)
├── NotFoundError (404)
├── UnauthorizedError (401)
├── AuthorizationError (403)
├── DatabaseError (500)
└── ExternalServiceError (503)
```

### Error Handling Pattern

```typescript
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const userId = await requireUserId(request);
    const data = await fetchData(userId);
    return json({ data });
  } catch (error) {
    if (error instanceof ValidationError) {
      return json({ error: error.message }, { status: 400 });
    }
    throw error; // Let error boundary handle
  }
}
```

---

## Authentication

### Require Authentication

```typescript
import { requireUserId } from "~/features/auth";

export async function loader({ request }: LoaderFunctionArgs) {
  // Throws if not authenticated
  const userId = await requireUserId(request);
  // ... rest of handler
}
```

### Optional Authentication

```typescript
import { getUser } from "~/features/auth";

export async function loader({ request }: LoaderFunctionArgs) {
  // Returns null if not authenticated
  const user = await getUser(request);
  // ... handle both cases
}
```

---

## Validation

### Input Validation

```typescript
import { z } from "zod";

const schema = z.object({
  field: z.string().min(1),
  number: z.number().int().positive(),
});

export async function action({ request }: ActionFunctionArgs) {
  const body = await request.json();

  // Validate
  const result = schema.safeParse(body);
  if (!result.success) {
    return json({ error: result.error.message }, { status: 400 });
  }

  // Use validated data
  const { field, number } = result.data;
}
```

### Query Parameter Validation

```typescript
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id || !isValidId(id)) {
    return json({ error: "Invalid ID" }, { status: 400 });
  }

  // Use validated ID
}
```

---

## Testing

### Unit Test Example

```typescript
// tests/integration/api.example.test.ts
import { describe, it, expect, vi } from "vitest";
import { loader } from "~/routes/api.example";

describe("API Example", () => {
  it("should return data", async () => {
    const request = new Request("http://localhost/api/example?param=value");
    const response = await loader({ request } as LoaderFunctionArgs);
    const data = await response.json();

    expect(data).toHaveProperty("data");
  });
});
```

See [Testing Guide](./testing.md) for more examples.

---

## Best Practices

### Do's ✅

- **Validate all input** - Never trust user input
- **Use authentication** - Check auth on protected endpoints
- **Handle errors gracefully** - Return appropriate error responses
- **Use consistent response format** - Standard JSON structure
- **Document endpoints** - Add JSDoc comments
- **Test thoroughly** - Write tests for all endpoints

### Don'ts ❌

- **Don't expose sensitive data** - Never return secrets or keys
- **Don't skip validation** - Always validate input
- **Don't ignore errors** - Handle all error cases
- **Don't use direct model imports** - Use feature service layers
- **Don't put business logic in routes** - Delegate to features

---

## Related Documentation

- [Developer Guide](./developer-guide.md) - Development workflow
- [API Reference](../reference/api.md) - All API endpoints
- [Testing Guide](./testing.md) - Testing strategies
- [Architecture Overview](../getting-started/architecture.md) - System design

---

**Next:** [API Reference](../reference/api.md) → View all API endpoints

