# API Usage

**Estimated time:** 40 minutes  
**Difficulty:** Advanced  
**Last updated:** 2025-03-12

Complete guide to using the SmartFlowSocial API for programmatic access, automation, and custom
integrations.

---

## Prerequisites

- ✅ Account created and logged in
- ✅ Programming experience (JavaScript/TypeScript recommended)
- ✅ Understanding of REST APIs
- ✅ Access to SmartFlowSocial instance
- ✅ Session cookie or authentication method

---

## Overview

**The SmartFlowSocial API provides:**

- Programmatic access to features
- Automation capabilities
- Custom integration support
- Batch operations
- Real-time data access

---

## Authentication

### Session-Based Authentication

**How it works:**

1. **User logs in** via Nostr extension
2. **Server creates session cookie**
3. **Cookie included** in API requests
4. **Server validates** session

**Getting session cookie:**

```typescript
// Browser environment
const sessionCookie = document.cookie
  .split("; ")
  .find((row) => row.startsWith("session="))
  ?.split("=")[1];

// Use in requests
const response = await fetch("/api/endpoint", {
  headers: {
    Cookie: `session=${sessionCookie}`,
  },
  credentials: "include",
});
```

### API Client Setup

```typescript
class SmartFlowSocialAPI {
  constructor(
    private baseUrl: string,
    private sessionCookie: string
  ) {}

  private async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}/api/${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Cookie: `session=${this.sessionCookie}`,
        ...options.headers,
      },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Request failed");
    }

    return await response.json();
  }
}
```

---

## Core API Endpoints

### Publishing Posts

**POST `/api/publish`**

```typescript
async publishEvent(event: any, relays: string[]) {
  return this.request('publish', {
    method: 'POST',
    body: JSON.stringify({
      event,
      relays,
    }),
  });
}

// Usage
const event = {
  kind: 1,
  content: 'Hello from API!',
  created_at: Math.floor(Date.now() / 1000),
  tags: [],
};

const signedEvent = await signEvent(event);
await api.publishEvent(signedEvent, [
  'wss://relay.example.com'
]);
```

### File Upload

**POST `/api/upload`**

```typescript
async uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${this.baseUrl}/api/upload`, {
    method: 'POST',
    headers: {
      'Cookie': `session=${this.sessionCookie}`,
    },
    credentials: 'include',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Upload failed');
  }

  const result = await response.json();
  return result.data.fileUrl;
}

// Usage
const file = new File(['...'], 'image.jpg', { type: 'image/jpeg' });
const imageUrl = await api.uploadFile(file);
```

### Queue Schedule

**POST `/api/queue-schedule`**

```typescript
async getQueueSchedule(
  queueTypeName: string,
  queueTypeId?: string
) {
  return this.request('queue-schedule', {
    method: 'POST',
    body: JSON.stringify({
      queueTypeName,
      queueTypeId,
    }),
  });
}

// Usage
const schedule = await api.getQueueSchedule('Bitcoin News');
console.log(schedule.nextScheduleTime);
```

### Effective Hashtags

**POST `/api/effective-hashtags`**

```typescript
async getEffectiveHashtags(
  queueTypeName: string,
  queueTypeId?: string
) {
  return this.request('effective-hashtags', {
    method: 'POST',
    body: JSON.stringify({
      queueTypeName,
      queueTypeId,
    }),
  });
}

// Usage
const hashtags = await api.getEffectiveHashtags('Bitcoin News');
console.log(hashtags.effectiveHashtags);
```

---

## Advanced API Patterns

### Batch Operations

**Process multiple items:**

```typescript
async function batchPublish(events: any[], relays: string[]) {
  const results = await Promise.allSettled(events.map((event) => this.publishEvent(event, relays)));

  return results.map((result, index) => ({
    index,
    success: result.status === "fulfilled",
    error: result.status === "rejected" ? result.reason : null,
  }));
}
```

### Retry Logic

**Handle transient failures:**

```typescript
async function publishWithRetry(event: any, relays: string[], maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await this.publishEvent(event, relays);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
}
```

### Rate Limiting

**Respect rate limits:**

```typescript
import pLimit from "p-limit";

const limit = pLimit(10); // Max 10 concurrent requests

async function processMany(items: any[]) {
  const requests = items.map((item) => limit(() => this.processItem(item)));

  return Promise.all(requests);
}
```

---

## Error Handling

### Standard Error Format

**All errors follow this format:**

```typescript
interface APIError {
  success: false;
  error: {
    message: string;
    code: string;
    statusCode: number;
    timestamp: string;
    context?: Record<string, unknown>;
  };
}
```

### Error Handling Pattern

```typescript
async function handleAPIError(response: Response) {
  if (!response.ok) {
    const error = await response.json();

    switch (error.error.statusCode) {
      case 400:
        throw new ValidationError(error.error.message);
      case 401:
        throw new AuthenticationError(error.error.message);
      case 403:
        throw new AuthorizationError(error.error.message);
      case 404:
        throw new NotFoundError(error.error.message);
      default:
        throw new APIError(error.error.message);
    }
  }

  return await response.json();
}
```

---

## Best Practices

### Request Optimization

1. **Batch requests** when possible
2. **Cache responses** when appropriate
3. **Use appropriate intervals** for polling
4. **Implement rate limiting** client-side

### Security

1. **Never expose session cookies** in client code
2. **Use environment variables** for sensitive data
3. **Validate all inputs** before sending
4. **Handle errors gracefully**

### Performance

1. **Use concurrent requests** wisely
2. **Implement connection pooling**
3. **Monitor API usage**
4. **Optimize payload sizes**

---

## Complete Example

**Full integration example:**

```typescript
import { SmartFlowSocialAPI } from "./api";
import { finalizeEvent } from "nostr-tools";

class ContentPublisher {
  constructor(
    private api: SmartFlowSocialAPI,
    private privateKey: string,
    private relays: string[]
  ) {}

  async publishPost(content: string, hashtags?: string[]) {
    // Create event
    const event = {
      kind: 1,
      content,
      created_at: Math.floor(Date.now() / 1000),
      tags: hashtags?.map((tag) => ["t", tag]) || [],
    };

    // Sign event
    const signedEvent = finalizeEvent(event, this.privateKey);

    // Publish
    return await this.api.publishEvent(signedEvent, this.relays);
  }

  async publishWithImage(content: string, imageFile: File) {
    // Upload image
    const imageUrl = await this.api.uploadFile(imageFile);

    // Create post with image
    const postContent = `${content}\n\n${imageUrl}`;

    return await this.publishPost(postContent);
  }

  async schedulePost(content: string, queueName: string, hashtags?: string[]) {
    // Get queue schedule
    const schedule = await this.api.getQueueSchedule(queueName);

    // Get effective hashtags
    const effectiveHashtags = await this.api.getEffectiveHashtags(queueName);

    // Combine hashtags
    const allHashtags = [
      ...(hashtags || []),
      ...(effectiveHashtags.effectiveHashtags.split(" ") || []),
    ];

    // Create event with scheduled time
    const event = {
      kind: 1,
      content: `${content}\n\n${allHashtags.join(" ")}`,
      created_at: Math.floor(new Date(schedule.nextScheduleTime).getTime() / 1000),
      tags: allHashtags.map((tag) => ["t", tag.replace("#", "")]),
    };

    // Sign and publish
    const signedEvent = finalizeEvent(event, this.privateKey);
    return await this.api.publishEvent(signedEvent, this.relays);
  }
}

// Usage
const api = new SmartFlowSocialAPI("https://your-domain.com", process.env.SESSION_COOKIE!);

const publisher = new ContentPublisher(api, process.env.NOSTR_PRIVATE_KEY!, [
  "wss://relay.example.com",
]);

// Publish simple post
await publisher.publishPost("Hello from API!", ["nostr", "api"]);

// Publish with image
const file = new File(["..."], "image.jpg");
await publisher.publishWithImage("Check out this image!", file);

// Schedule post
await publisher.schedulePost("Scheduled post", "Bitcoin News");
```

---

## Troubleshooting

### Authentication Failures

**Problem:** 401 Unauthorized errors

**Solutions:**

- Verify session cookie is valid
- Check cookie hasn't expired
- Ensure credentials are included
- Re-authenticate if needed

### Rate Limiting

**Problem:** 429 Too Many Requests

**Solutions:**

- Implement rate limiting
- Add delays between requests
- Batch requests when possible
- Use exponential backoff

### Network Errors

**Problem:** Connection failures

**Solutions:**

- Check network connectivity
- Verify API endpoint URL
- Implement retry logic
- Handle timeouts gracefully

---

## What You Learned

✅ How to authenticate with the API  
✅ How to use core endpoints  
✅ How to handle errors  
✅ How to implement best practices  
✅ How to build complete integrations

---

## Next Steps

1. **[Custom Integrations](./custom-integrations.md)** - Build integrations
2. **[Advanced Queue Management](./advanced-queue-management.md)** - Master queues
3. **[Operations Guide](../../guides/operations.md#performance-monitoring)** - Performance
   optimization

---

## Related Documentation

- [API Reference](../../reference/api.md) - Complete API docs
- [Integration Examples](../../examples/integrations.md) - Integration examples
- [Developer Guide](../../guides/developer-guide.md) - Development workflow

---

**Next Tutorial:** [Advanced Queue Management](./advanced-queue-management.md) → Master queue
systems
