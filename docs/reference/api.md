# API Reference

This document describes all API endpoints available in SmartFlowSocial, including request/response
formats, authentication, error handling, and usage examples.

**Last verified:** 2025-03 (against `app/routes/api.*`, `app/routes/internal.*`, and `cron.*`).

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Base URL](#base-url)
- [Request/Response Format](#requestresponse-format)
- [Error Handling](#error-handling)
- [Endpoints](#endpoints)
- [Rate Limiting](#rate-limiting)
- [Best Practices](#best-practices)
- [Examples](#examples)

---

## Overview

All API routes are located in `app/routes/api.*.tsx`. These endpoints handle various background
operations for the application, including file uploads, post publishing, queue management, and user
operations.

**API Design Principles:**

- RESTful where applicable
- JSON request/response format
- Consistent error handling
- Authentication required for most endpoints

---

## Authentication

Most API endpoints require an authenticated session. Authentication is handled via Nostr login
(NIP-07) with session cookies.

### Authentication Flow

1. User logs in via Nostr extension
2. Server creates session cookie
3. Cookie included in subsequent requests
4. Server validates session on each request

### Authentication Headers

No special headers required. Session is managed via cookies.

### Unauthenticated Requests

Some endpoints may work without authentication (e.g., public health checks), but most require
authentication.

---

## Base URL

All API endpoints are relative to your SmartFlowSocial instance:

```
https://your-domain.com/api/...
```

For local development:

```
http://localhost:3000/api/...
```

---

## Request/Response Format

### Request Format

**Content-Type:** `application/json` (for JSON requests) or `multipart/form-data` (for file uploads)

**Example:**

```bash
curl -X POST https://your-domain.com/api/publish \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{"signedEvent": {...}, "postId": "123"}'
```

### Response Format

**Success Response:**

```json
{
  "success": true,
  "data": { ... }
}
```

**Error Response:**

```json
{
  "error": "Error message",
  "status": 400
}
```

---

## Error Handling

All API endpoints return errors in a consistent format:

```json
{
  "error": "Error message",
  "status": 400
}
```

### HTTP Status Codes

| Code  | Meaning               | Description              |
| ----- | --------------------- | ------------------------ |
| `200` | OK                    | Request successful       |
| `201` | Created               | Resource created         |
| `400` | Bad Request           | Invalid parameters       |
| `401` | Unauthorized          | Not authenticated        |
| `403` | Forbidden             | Insufficient permissions |
| `404` | Not Found             | Resource not found       |
| `500` | Internal Server Error | Server error             |

### Error Types

- **ValidationError**: Invalid input (400)
- **NotFoundError**: Resource not found (404)
- **UnauthorizedError**: Not authenticated (401)
- **DatabaseError**: Database operation failed (500)
- **ExternalServiceError**: External service error (503)

---

## Endpoints

### Upload

#### POST `/api/upload`

Upload files to S3-compatible storage (or configured upload provider).

**Request:**

- Content-Type: `multipart/form-data`
- Body: FormData with `file` field
- Max file size: 100MB (for videos)

**Response:**

```json
{
  "success": true,
  "data": {
    "fileUrl": "https://storage.example.com/image.jpg"
  }
}
```

**Supported formats:**

- Images: JPEG, PNG, WebP, GIF
- Videos: MP4, WebM, MOV

**Note:** Files are automatically processed and optimized. Images are resized if needed.

---

#### POST `/api/upload-blossom`

Upload files to Blossom storage.

**Request:**

- Content-Type: `multipart/form-data`
- Body: File data and Blossom authentication

SmartFlow accepts metadata from two lanes:

- **Authoritative SFS lane**: tokenized uploads committed via `/internal/blossom/commit-batch` are
  quota/accounting source of truth.
- **Compatibility lane**: simple Blossom-auth uploads/mirror metadata are accepted for media
  metadata persistence but treated as non-authoritative for reservation/usage accounting.

**Response:**

```json
{
  "url": "https://blossom.example.com/image.jpg"
}
```

---

#### POST `/api/blossom/tokens`

Issue bulk upload tokens for SmartFlow Blossom v2. Requires user session.

This endpoint is the authoritative upload admission path for SFS quota-safe uploads.

**Request:**

```json
{
  "files": [
    {
      "sha256": "hex_sha256",
      "size": 12345,
      "type": "image/png",
      "filename": "example.png"
    }
  ]
}
```

**Response (partial success allowed):**

```json
{
  "uploadUrl": "https://blossom-api.smartflow.social/upload",
  "batchId": "uuid",
  "expiresIn": 900,
  "results": [
    { "sha256": "hex_sha256", "size": 12345, "token": "jwt", "expiresIn": 180 },
    { "sha256": "hex_sha256_b", "size": 99999, "error": "quota_exceeded" }
  ]
}
```

---

#### POST `/internal/blossom/commit-batch`

Internal server-to-server endpoint used by Blossom to commit successful uploads. Requires
`x-internal-secret` matching `BLOSSOM_INTERNAL_SECRET`.

**Request:**

```json
{
  "batchId": "uuid",
  "items": [
    {
      "jti": "uuid",
      "pubkey": "hex_pubkey",
      "sha256": "hex_sha256",
      "size": 12345,
      "type": "image/png",
      "url": "https://blossom-api.smartflow.social/sha-or-key"
    }
  ]
}
```

---

#### GET `/internal/blossom/policy`

Internal server-to-server policy endpoint used by SFS compatibility lane pre-checks. Requires
`x-internal-secret` matching `BLOSSOM_INTERNAL_SECRET`.

**Query:**

- `pubkey` (hex)

**Response:**

```json
{
  "active": true,
  "planId": "pro",
  "allowCompatUpload": true,
  "reason": "allowed"
}
```

Compatibility hardening policy:

- free/inactive/missing users return `allowCompatUpload: false`
- SFS treats lookup failures as fail-closed (`service_unavailable`)

---

#### POST `/api/upload-editorjs-image`

Upload images from the EditorJS rich text editor.

**Request:**

- Content-Type: `multipart/form-data`
- Body: Image file from EditorJS

**Response:**

```json
{
  "success": 1,
  "file": {
    "url": "https://storage.example.com/image.jpg"
  }
}
```

---

#### POST `/api/media/intents`

Create a media ingest intent (declare files before upload). Returns provider and upload
instructions.

**Request:**

```json
{
  "files": [
    { "fileName": "image.png", "size": 12345, "mimeType": "image/png", "sha256": "optional_hex" }
  ]
}
```

**Response:** Intent object with `provider` and per-provider upload details.

---

#### POST `/api/media/commit`

Commit media after successful upload (register URLs and metadata for the current user).

**Request:**

```json
{
  "items": [
    {
      "fileName": "image.png",
      "url": "https://...",
      "size": 12345,
      "mimeType": "image/png",
      "provider": "S3" | "BLOSSOM_PRIMAL" | "BLOSSOM_BLOSSTR" | "BLOSSOM_SFS" | "BLOSSOM_CUSTOM",
      "sha256": "optional_hex"
    }
  ]
}
```

**Response:** `{ "committed": [ ... ], ... }` with committed items.

---

### Posts

#### POST `/api/publish`

Publish a signed Nostr event to relays via the HTTP Nostr Publisher service.

**Request:**

```json
{
  "relays": ["wss://relay.example.com", "wss://relay2.example.com"],
  "event": {
    "id": "event_id",
    "pubkey": "pubkey",
    "created_at": 1234567890,
    "kind": 1,
    "tags": [],
    "content": "Hello Nostr!",
    "sig": "signature"
  }
}
```

**Response:**

```json
{
  "success": true,
  "message": "Published successfully"
}
```

**Note:** Requires `NOSTR_PUBLISHER_URL` environment variable to be configured. The event must be
signed client-side before sending.

---

#### POST `/api/posts/batch`

Fetch multiple posts by ID for the current user.

**Request:**

```json
{
  "postIds": ["post_1", "post_2"]
}
```

**Response:** Array of post data for the given IDs (only posts owned by the user).

---

#### GET `/api/posts/:id`

Fetch a single post by ID for the current user.

**Response:** Post data (caption, content, fileUrl, scheduledFor, currentState, etc.) or 404 if not
found or not owned.

---

#### POST `/api/post-stats`

Fetch post stats (engagement counts) for multiple Nostr event IDs.

**Request:**

```json
{
  "eventIds": ["event_id_1", "event_id_2"]
}
```

**Response:**

```json
{
  "stats": {
    "event_id_1": { "replies": 5, "reposts": 2, "likes": 10, ... },
    "event_id_2": { ... }
  }
}
```

---

#### GET `/api/publish-result`

Poll relay acknowledgements for a publish attempt.

**Query Parameters:** `postId` (required), `publishAttemptId` (required).

**Response:**

```json
{
  "acks": [{ "relayUrl": "wss://...", "status": "...", "receivedAt": "...", "createdAt": "..." }]
}
```

---

### Queue & Scheduling

#### POST `/api/queue-schedule`

Get the calculated next schedule time for a queue.

**Request:**

```json
{
  "queueTypeName": "Bitcoin News",
  "queueTypeId": "queue_123"
}
```

**Response:**

```json
{
  "nextScheduleTime": "2024-01-15T10:00:00Z",
  "formattedTime": "2024-01-15 10:00"
}
```

**Note:** Calculates next available time slot based on queue schedule rules (interval or fixed
slots).

---

#### POST `/api/effective-hashtags`

Get the effective hashtags for a post based on queue and preset settings.

**Request:**

```json
{
  "queueTypeName": "Bitcoin News",
  "queueTypeId": "queue_123"
}
```

**Response:**

```json
{
  "effectiveHashtags": "#nostr #bitcoin #lightning"
}
```

**Note:** Returns hashtag preset assigned to the queue type, or empty if none assigned.

---

### Search

#### GET `/api/global-search` / POST `/api/global-search`

Search across the application (posts, queues, etc.) for the current user.

**Query (GET):** `q` (required, min 2 characters), `context` (optional).

**Body (POST):** FormData with `q` (required, min 2 characters), `context` (optional).

**Response:**

```json
{
  "results": [ ... ],
  "total": 10
}
```

**Note:** Requires authentication. Returns up to 5 results per request.

---

### User Management

#### GET `/api/user-upload-provider`

Get the current user's upload provider setting.

**Response:**

```json
{
  "provider": "S3"
}
```

---

#### GET `/api/primary-signer-profile`

Get the current user's preferred NIP-46 signer profile (non-secret metadata only).

**Response:**

```json
{
  "primarySignerProfile": { ... } | null
}
```

**Note:** Used for account-level preferred remote signer display/settings.

---

#### GET `/api/children`

Get child accounts linked to the current user.

**Response:**

```json
{
  "children": [
    { "npub": "npub1...", "profile": { ... } }
  ]
}
```

---

#### POST `/api/parent`

Manage parent-child account relationships.

**Request:**

```json
{
  "action": "request|accept|reject",
  "childNpub": "npub1..."
}
```

---

### Push Notifications

#### GET `/api/push-subscribe`

Get the VAPID public key for Web Push subscription. No request body. Used by the client before
calling POST to subscribe.

**Response:**

```json
{
  "publicKey": "BEl62iUYgUivxIkv69yViEuiHIa-I0..."
}
```

**Note:** Returns 503 if VAPID keys are not configured.

---

#### POST `/api/push-subscribe`

Subscribe to push notifications for the current user.

**Request:**

```json
{
  "endpoint": "https://...",
  "keys": { "p256dh": "...", "auth": "..." }
}
```

**Response:** `200` on success.

---

#### POST `/api/push-unsubscribe`

Unsubscribe from push notifications.

**Request:**

```json
{
  "endpoint": "https://..."
}
```

**Response:** `{ "success": true }` or 404 if subscription not found.

---

### External Data

#### GET `/api/zap-profile`

Get Lightning address (lud16) for a Nostr pubkey for NIP-57 zap flow. No authentication required.

**Query Parameters:** `npub` (required) — Nostr public key (npub or hex).

**Response:**

```json
{
  "lud16": "user@domain.com" | null
}
```

---

#### GET `/api/profile-display-name`

Get display name for a Nostr pubkey (e.g. for "Signing in as username"). No authentication required.

**Query Parameters:** `pubkey` (optional) — Nostr public key (npub or hex).

**Response:**

```json
{
  "displayName": "username" | null
}
```

---

#### GET `/api/link-preview`

Fetch Open Graph preview data for a URL.

**Query Parameters:**

- `url` - URL to fetch preview for

**Response:**

```json
{
  "title": "Page Title",
  "description": "Page description",
  "image": "https://example.com/og-image.jpg"
}
```

---

#### GET `/api/thread-view`

Fetch a Nostr thread from the cache or relays.

**Query Parameters:**

- `eventId` - Root event ID

**Response:**

```json
{
  "events": [ ... ],
  "rootEvent": { ... }
}
```

---

### Engagement

#### POST `/api/engagement/mark-state`

Mark an engagement item (e.g. reply/mention) as handled or update replied-from-app state.

**Request:**

```json
{
  "eventId": "nostr_event_id",
  "repliedFromApp": true
}
```

**Response:** `{ "success": true }` or 400.

---

#### GET `/api/engagement/reply-templates` / POST `/api/engagement/reply-templates`

List (GET) or manage (POST) reply templates for the engagement feed.

**GET Response:**

```json
{
  "templates": [ { "slug": "...", "body": "..." }, ... ]
}
```

**POST Request:** JSON body with `action`: `"create"` (requires `slug`, `body`), `"update"`
(requires `id`, `slug` or `body`), or `"delete"` (requires `id`).

**Response:** `{ "success": true }` or 400.

---

### Error Metrics

#### GET `/api/error-metrics`

Get error metrics and statistics.

**Query Parameters:**

- `summary` (boolean) - Return summary metrics with error rate
- `top` (number) - Get top N error codes (e.g., `?top=10`)
- `checkRate` (boolean) - Check if error rate is high

**Response (summary=true):**

```json
{
  "summary": {
    "totalErrors": 150,
    "errorsByCode": { ... },
    "errorsByType": { ... }
  },
  "errorRate": {
    "perMinute": 5.2,
    "isHigh": false,
    "threshold": 10
  }
}
```

**Response (top=N):**

```json
{
  "topErrors": [
    { "code": "VALIDATION_ERROR", "count": 45 },
    { "code": "NOT_FOUND", "count": 32 }
  ]
}
```

**Response (checkRate=true):**

```json
{
  "errorRate": 5.2,
  "isHigh": false,
  "threshold": 10
}
```

**Response (default):**

```json
{
  "metrics": { ... },
  "errorRate": 5.2
}
```

> **Note:** This endpoint requires authentication and should be restricted to admins in production.

---

### Payments

#### POST `/api/payment-status`

Check the status of a Lightning payment. Accepts JSON or FormData.

**Request (JSON):** `{ "paymentId": "payment_123" }`  
**Request (FormData):** `paymentId` field.

**Response:**

```json
{
  "status": "COMPLETED",
  "paid": true,
  "paidAt": "2024-01-15T10:00:00Z"
}
```

**Note:** GET returns 405; use POST with `paymentId` in body.

---

## Cron Endpoints

### POST `/cron/checksubscription`

Check and update subscription statuses.

**Note:** This endpoint should be called periodically (e.g., daily) to:

- Mark expired subscriptions as inactive
- Send renewal reminders
- Process subscription updates

---

## Error Handling

All API endpoints return errors in a consistent format:

```json
{
  "error": "Error message",
  "status": 400
}
```

Common HTTP status codes:

- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (not logged in)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

---

## Rate Limiting

Currently, there is no built-in rate limiting. For production deployments, consider adding rate
limiting at the reverse proxy level (e.g., nginx, Cloudflare).

**Recommended Limits:**

- General API: 100 requests per 15 minutes per IP
- Upload endpoints: 20 requests per 15 minutes per IP
- Publish endpoints: 50 requests per 15 minutes per IP

### Implementing Rate Limiting

```typescript
import rateLimit from "express-rate-limit";

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests
});

app.use("/api/", apiLimiter);
```

---

## CORS

API endpoints are same-origin only by default. If you need cross-origin access, configure CORS in
`server.ts`.

### Enabling CORS

```typescript
// eslint-disable-next-line import/no-unresolved
import cors from "cors";

app.use(
  cors({
    origin: "https://allowed-origin.com",
    credentials: true,
  })
);
```

---

## Best Practices

### Making API Requests

1. **Always Handle Errors**: Check response status
2. **Use Proper Headers**: Set Content-Type correctly
3. **Validate Input**: Validate before sending
4. **Handle Timeouts**: Set appropriate timeouts
5. **Retry Logic**: Implement retry for transient errors

### Example: Error Handling

```typescript
async function apiCall() {
  try {
    const response = await fetch("/api/endpoint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Request failed");
    }

    return await response.json();
  } catch (error) {
    console.error("API call failed:", error);
    throw error;
  }
}
```

### Example: Retry Logic

```typescript
async function apiCallWithRetry(maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```

---

## Examples

### Complete Example: Publishing a Post

```typescript
// 1. Sign event client-side
const signedEvent = await window.nostr.signEvent({
  kind: 1,
  content: "Hello Nostr!",
  created_at: Math.floor(Date.now() / 1000),
  tags: [],
});

// 2. Send to API
const response = await fetch("/api/publish", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  credentials: "include", // Include session cookie
  body: JSON.stringify({
    signedEvent,
    postId: "post_123",
  }),
});

// 3. Handle response
if (response.ok) {
  const result = await response.json();
  console.log("Published:", result.eventId);
} else {
  const error = await response.json();
  console.error("Error:", error.error);
}
```

### Complete Example: Uploading an Image

```typescript
const formData = new FormData();
formData.append("file", fileInput.files[0]);

const response = await fetch("/api/upload", {
  method: "POST",
  credentials: "include",
  body: formData,
});

if (response.ok) {
  const { url } = await response.json();
  console.log("Uploaded:", url);
}
```

---

## Additional Resources

- [Architecture Documentation](../getting-started/architecture.md) - System architecture
- [Nostr Integration](../reference/nostr.md) - Nostr protocol details
- [Troubleshooting Guide](../troubleshooting/common-issues.md) - Common issues and solutions
- [Security Guide](../guides/security.md) - Security best practices
