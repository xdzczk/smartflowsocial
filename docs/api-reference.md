# API Reference

This document describes the API endpoints available in SmartFlowSocial.

## Overview

All API routes are located in `app/routes/api.*.tsx`. These endpoints handle various background operations for the application.

## Authentication

Most API endpoints require an authenticated session. Authentication is handled via Nostr login (NIP-07) with session cookies.

---

## Endpoints

### Upload

#### POST `/api/upload`
Upload files to S3-compatible storage.

**Request:**
- Content-Type: `multipart/form-data`
- Body: File data

**Response:**
```json
{
  "url": "https://storage.example.com/image.jpg"
}
```

---

#### POST `/api/upload-blossom`
Upload files to Blossom storage.

**Request:**
- Content-Type: `multipart/form-data`
- Body: File data and Blossom authentication

**Response:**
```json
{
  "url": "https://blossom.example.com/image.jpg"
}
```

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

### Posts

#### POST `/api/publish`
Publish a signed Nostr event to relays.

**Request:**
```json
{
  "signedEvent": { ... },
  "postId": "post_123"
}
```

**Response:**
```json
{
  "success": true,
  "eventId": "nostr_event_id"
}
```

---

#### POST `/api/posts/batch`
Batch operations on multiple posts.

**Request:**
```json
{
  "action": "delete|schedule",
  "postIds": ["post_1", "post_2"]
}
```

---

### Queue & Scheduling

#### GET `/api/queue-schedule`
Get the calculated next schedule time for a queue.

**Query Parameters:**
- `queueTypeId` - Queue type ID
- `timezone` - User timezone

**Response:**
```json
{
  "nextScheduleTime": "2024-01-15T10:00:00Z",
  "formattedTime": "2024-01-15 10:00"
}
```

---

#### GET `/api/effective-hashtags`
Get the effective hashtags for a post based on queue and preset settings.

**Query Parameters:**
- `queueTypeId` - Queue type ID (optional)
- `hashTagPresetId` - Hashtag preset ID (optional)

**Response:**
```json
{
  "effectiveHashtags": "#nostr #bitcoin #lightning"
}
```

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

### External Data

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

#### GET `/api/payment-status`
Check the status of a Lightning payment.

**Query Parameters:**
- `paymentId` - Payment ID

**Response:**
```json
{
  "status": "COMPLETED",
  "paid": true,
  "paidAt": "2024-01-15T10:00:00Z"
}
```

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

Currently, there is no built-in rate limiting. For production deployments, consider adding rate limiting at the reverse proxy level (e.g., nginx, Cloudflare).

---

## CORS

API endpoints are same-origin only by default. If you need cross-origin access, configure CORS in `server.ts`.
