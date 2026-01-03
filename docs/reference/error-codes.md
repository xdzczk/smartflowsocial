# Error Codes Reference

**Last updated:** 2026-01-02

Complete reference of all error codes, error types, and error handling patterns in SmartFlowSocial.

---

## Table of Contents

- [Error Types](#error-types)
- [Error Codes](#error-codes)
- [HTTP Status Codes](#http-status-codes)
- [Error Response Format](#error-response-format)
- [Error Handling](#error-handling)

---

## Error Types

### AppError

**Base class** for all application errors.

**Properties:**

- `statusCode: number` - HTTP status code
- `code: string` - Error code
- `isOperational: boolean` - Whether error is operational
- `context?: Record<string, unknown>` - Additional context
- `timestamp: string` - Error timestamp

**Usage:**

```typescript
throw new AppError("Something went wrong", 500, "INTERNAL_ERROR");
```

### ValidationError

**Status:** 400  
**Code:** `VALIDATION_ERROR`  
**Use case:** Input validation failures

**Example:**

```typescript
throw new ValidationError("Invalid email format", { field: "email" });
```

### AuthenticationError

**Status:** 401  
**Code:** `AUTHENTICATION_ERROR`  
**Use case:** Authentication required

**Example:**

```typescript
throw new AuthenticationError("Please log in to continue");
```

### AuthorizationError

**Status:** 403  
**Code:** `AUTHORIZATION_ERROR`  
**Use case:** Insufficient permissions

**Example:**

```typescript
throw new AuthorizationError(
  "You don't have permission to access this resource",
);
```

### NotFoundError

**Status:** 404  
**Code:** `NOT_FOUND_ERROR`  
**Use case:** Resource not found

**Example:**

```typescript
throw new NotFoundError("Post not found", { postId: "123" });
```

### ConflictError

**Status:** 409  
**Code:** `CONFLICT_ERROR`  
**Use case:** Resource conflicts (duplicates, etc.)

**Example:**

```typescript
throw new ConflictError("A record with this information already exists");
```

### RateLimitError

**Status:** 429  
**Code:** `RATE_LIMIT_ERROR`  
**Use case:** Rate limit exceeded

**Example:**

```typescript
throw new RateLimitError("Too many requests. Please try again later.");
```

### ExternalServiceError

**Status:** 502, 503, 504  
**Code:** `EXTERNAL_SERVICE_ERROR`  
**Use case:** External service failures

**Example:**

```typescript
throw new ExternalServiceError("Failed to connect to Nostr relay", 502, {
  service: "NostrRelay",
});
```

### DatabaseError

**Status:** 500  
**Code:** `DATABASE_ERROR`  
**Use case:** Database operation failures

**Example:**

```typescript
throw new DatabaseError("Database query failed", {
  query: "SELECT * FROM posts",
});
```

---

## Error Codes

### Complete List

| Code                     | Description               | Status Code |
| ------------------------ | ------------------------- | ----------- |
| `VALIDATION_ERROR`       | Input validation failed   | 400         |
| `AUTHENTICATION_ERROR`   | Authentication required   | 401         |
| `AUTHORIZATION_ERROR`    | Insufficient permissions  | 403         |
| `NOT_FOUND_ERROR`        | Resource not found        | 404         |
| `CONFLICT_ERROR`         | Resource conflict         | 409         |
| `RATE_LIMIT_ERROR`       | Rate limit exceeded       | 429         |
| `EXTERNAL_SERVICE_ERROR` | External service failure  | 502/503/504 |
| `DATABASE_ERROR`         | Database operation failed | 500         |
| `INTERNAL_ERROR`         | Internal server error     | 500         |
| `UNKNOWN_ERROR`          | Unknown error type        | 500         |

### Error Code Enum

```typescript
export const ErrorCodes = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  AUTHENTICATION_ERROR: "AUTHENTICATION_ERROR",
  AUTHORIZATION_ERROR: "AUTHORIZATION_ERROR",
  NOT_FOUND_ERROR: "NOT_FOUND_ERROR",
  CONFLICT_ERROR: "CONFLICT_ERROR",
  RATE_LIMIT_ERROR: "RATE_LIMIT_ERROR",
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
};
```

---

## HTTP Status Codes

### Client Errors (4xx)

- **400 Bad Request** - Validation errors
- **401 Unauthorized** - Authentication required
- **403 Forbidden** - Authorization failed
- **404 Not Found** - Resource not found
- **409 Conflict** - Resource conflict

### Server Errors (5xx)

- **500 Internal Server Error** - Internal errors
- **502 Bad Gateway** - External service error
- **503 Service Unavailable** - Service unavailable
- **504 Gateway Timeout** - Request timeout

### Rate Limiting

- **429 Too Many Requests** - Rate limit exceeded

---

## Error Response Format

### Standard Error Response

```json
{
  "success": false,
  "error": {
    "message": "User-friendly error message",
    "code": "VALIDATION_ERROR",
    "statusCode": 400,
    "timestamp": "2026-01-02T12:00:00.000Z",
    "context": {
      "field": "email",
      "value": "invalid"
    }
  }
}
```

### Error Response Fields

**message:**

- User-friendly error message
- Safe to display to users
- May be sanitized in production

**code:**

- Error code string
- Used for error handling logic
- Consistent across application

**statusCode:**

- HTTP status code
- Matches HTTP response status

**timestamp:**

- ISO 8601 timestamp
- When error occurred
- Useful for debugging

**context:**

- Additional error context
- May include sensitive data (sanitized)
- Useful for debugging

---

## Error Handling

### Server-Side Error Handling

**Error normalization:**

```typescript
import { normalizeError } from "~/lib/errors";

try {
  // Code that may throw
} catch (error) {
  const normalizedError = normalizeError(error);
  // Handle normalized error
}
```

**Error response creation:**

```typescript
import { createErrorResponse } from "~/lib/error-handler.server";

const [errorResponse, statusCode] = createErrorResponse(error);
return json(errorResponse, { status: statusCode });
```

### Client-Side Error Handling

**Error logging:**

```typescript
import { logClientError } from "~/lib/error-handler.client";

logClientError(error, {
  component: "MyComponent",
  action: "handleSubmit",
});
```

**API error handling:**

```typescript
import { handleApiError } from "~/lib/error-handler.client";

const errorMessage = handleApiError(response);
// Display error message to user
```

### Error Logging

**Server-side logging:**

- Structured JSON logs in production
- Readable format in development
- Automatic sanitization of sensitive data
- Error metrics recording

**Client-side logging:**

- Console logging in development
- Optional external service integration
- Context preservation
- User action tracking

---

## Common Error Scenarios

### Validation Errors

**When they occur:**

- Invalid input format
- Missing required fields
- Value out of range
- Invalid data type

**How to handle:**

- Display field-specific errors
- Highlight invalid fields
- Show validation messages
- Prevent form submission

### Authentication Errors

**When they occur:**

- User not logged in
- Session expired
- Invalid credentials
- Token invalid

**How to handle:**

- Redirect to login
- Show login prompt
- Refresh session
- Clear invalid tokens

### Authorization Errors

**When they occur:**

- Insufficient permissions
- Feature not available
- Plan upgrade required
- Access denied

**How to handle:**

- Show upgrade prompt
- Hide unavailable features
- Display permission message
- Redirect to plans page

### Not Found Errors

**When they occur:**

- Resource deleted
- Invalid ID
- URL not found
- Route not found

**How to handle:**

- Show 404 page
- Display not found message
- Provide navigation options
- Log for investigation

### External Service Errors

**When they occur:**

- Nostr relay unavailable
- Primal cache down
- S3 upload failed
- Network issues

**How to handle:**

- Show retry option
- Display service status
- Queue for retry
- Log for monitoring

---

## Error Best Practices

### Error Messages

1. **User-friendly:**

   - Clear and understandable
   - Actionable when possible
   - Avoid technical jargon

2. **Contextual:**

   - Include relevant details
   - Show what went wrong
   - Suggest solutions

3. **Secure:**
   - Don't expose sensitive data
   - Sanitize error messages
   - Hide internal details in production

### Error Handling

1. **Catch early:**

   - Validate input early
   - Check permissions first
   - Handle errors at boundaries

2. **Log appropriately:**

   - Log all errors
   - Include context
   - Sanitize sensitive data

3. **Recover gracefully:**
   - Provide fallbacks
   - Show retry options
   - Maintain user experience

---

## Related Documentation

- [Configuration Reference](./configuration.md) - Environment configuration
- [API Reference](./api.md) - API error responses
- [Troubleshooting Guide](../troubleshooting/common-issues.md) - Common error solutions

---

**Next:** [Plan Features Reference](./plan-features.md) → Subscription plan details


