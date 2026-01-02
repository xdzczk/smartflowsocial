# Code Samples

**Last updated:** 2026-01-02

Working code examples for common SmartFlowSocial development tasks.

---

## Table of Contents

- [Authentication](#authentication)
- [Database Operations](#database-operations)
- [API Endpoints](#api-endpoints)
- [Queue Operations](#queue-operations)
- [File Uploads](#file-uploads)
- [Nostr Operations](#nostr-operations)

---

## Authentication

### Require Authentication

```typescript
// app/routes/dashboard.posts.tsx
import { requireUserId } from "~/features/auth";
import type { LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  // Throws if not authenticated
  const userId = await requireUserId(request);
  
  // Use userId for data fetching
  const posts = await getPostsByUserId(userId);
  return json({ posts });
}
```

### Optional Authentication

```typescript
import { getUser } from "~/features/auth";

export async function loader({ request }: LoaderFunctionArgs) {
  // Returns null if not authenticated
  const user = await getUser(request);
  
  if (user) {
    // Authenticated user
    const posts = await getPostsByUserId(user.id);
    return json({ posts });
  } else {
    // Public content
    const posts = await getPublicPosts();
    return json({ posts });
  }
}
```

---

## Database Operations

### Create Record

```typescript
// app/models/post.server.ts
import { prisma } from "~/lib/prisma.server";

export async function createPost(data: {
  userId: string;
  content: string;
  scheduledAt?: Date;
}) {
  return prisma.post.create({
    data: {
      userId: data.userId,
      content: data.content,
      scheduledAt: data.scheduledAt,
      status: data.scheduledAt ? "SCHEDULED" : "DRAFT",
    },
  });
}
```

### Query with Relations

```typescript
export async function getPostWithUser(postId: string) {
  return prisma.post.findUnique({
    where: { id: postId },
    include: {
      user: {
        select: {
          id: true,
          npub: true,
          profile: true,
        },
      },
    },
  });
}
```

### Pagination

```typescript
export async function getPostsPaginated(
  userId: string,
  page: number = 1,
  pageSize: number = 20
) {
  const skip = (page - 1) * pageSize;
  
  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where: { userId },
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.post.count({ where: { userId } }),
  ]);
  
  return {
    posts,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}
```

---

## API Endpoints

### GET Endpoint

```typescript
// app/routes/api.posts.tsx
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { requireUserId } from "~/features/auth";
import { getPostsByUserId } from "~/features/posts";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const url = new URL(request.url);
  
  // Parse query parameters
  const status = url.searchParams.get("status");
  const page = parseInt(url.searchParams.get("page") || "1");
  
  // Fetch data
  const posts = await getPostsByUserId(userId, { status, page });
  
  return json({ posts });
}
```

### POST Endpoint

```typescript
// app/routes/api.posts.tsx
import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { requireUserId } from "~/features/auth";
import { ValidationError } from "~/lib/errors";
import { createPost } from "~/features/posts";

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }
  
  const body = await request.json();
  
  // Validate
  if (!body.content) {
    throw new ValidationError("Content is required");
  }
  
  // Create post
  const post = await createPost({
    userId,
    content: body.content,
    scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
  });
  
  return json({ post }, { status: 201 });
}
```

---

## Queue Operations

### Schedule Post

```typescript
// app/features/posts/services/scheduling.server.ts
import { Queue } from "bullmq";
import { redis } from "~/lib/redis.server";

const postQueue = new Queue("post-publish", {
  connection: redis,
});

export async function schedulePost(postId: string, scheduledAt: Date) {
  const delay = scheduledAt.getTime() - Date.now();
  
  await postQueue.add(
    "publish-post",
    { postId },
    {
      delay,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
    }
  );
}
```

### Process Queue Job

```typescript
// worker.ts
import { Worker } from "bullmq";
import { redis } from "~/lib/redis.server";
import { publishPost } from "~/features/posts/services/publishing.server";

const worker = new Worker(
  "post-publish",
  async (job) => {
    const { postId } = job.data;
    await publishPost(postId);
  },
  {
    connection: redis,
    concurrency: 5,
  }
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job.id} failed:`, err);
});
```

---

## File Uploads

### Upload to S3

```typescript
// app/features/upload/services/storage.server.ts
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

const s3Client = new S3Client({
  region: process.env.STORAGE_REGION!,
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY!,
    secretAccessKey: process.env.STORAGE_SECRET!,
  },
});

export async function uploadFile(file: File, userId: string) {
  const key = `${userId}/${uuidv4()}-${file.name}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  
  await s3Client.send(
    new PutObjectCommand({
      Bucket: process.env.STORAGE_BUCKET!,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    })
  );
  
  const url = `https://${process.env.STORAGE_BUCKET}.s3.${process.env.STORAGE_REGION}.amazonaws.com/${key}`;
  return url;
}
```

### Handle Upload in Route

```typescript
// app/routes/api.upload.tsx
import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { requireUserId } from "~/features/auth";
import { uploadFile } from "~/features/upload/services/storage.server";

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const file = formData.get("file") as File;
  
  if (!file) {
    return json({ error: "File required" }, { status: 400 });
  }
  
  const url = await uploadFile(file, userId);
  return json({ url });
}
```

---

## Nostr Operations

### Sign Event Client-Side

```typescript
// Client-side code
async function signEvent(content: string) {
  if (!window.nostr) {
    throw new Error("Nostr extension not found");
  }
  
  const event = {
    kind: 1,
    content,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
  };
  
  const signedEvent = await window.nostr.signEvent(event);
  return signedEvent;
}
```

### Publish to Relays

```typescript
// app/features/posts/services/publishing.server.ts
export async function publishPost(postId: string) {
  const post = await getPostById(postId);
  
  if (!post.signedEvent) {
    throw new Error("Post not signed");
  }
  
  // Send to HTTP Nostr Publisher
  const response = await fetch(process.env.NOSTR_PUBLISHER_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: post.signedEvent,
    }),
  });
  
  if (!response.ok) {
    throw new Error("Failed to publish");
  }
  
  // Update post status
  await updatePostStatus(postId, "POSTED");
}
```

---

## Advanced Patterns

### Error Handling with Retry Logic

**Real-world scenario:** Network requests can fail, implement retry with exponential backoff.

```typescript
// app/lib/retry.server.ts
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = initialDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

// Usage: Publishing with retry
export async function publishPostWithRetry(postId: string) {
  return retryWithBackoff(async () => {
    return await publishPost(postId);
  }, 3, 1000);
}
```

**Common pitfalls:**
- ❌ Not implementing backoff (can overwhelm services)
- ❌ Retrying on all errors (some errors shouldn't be retried)
- ✅ Only retry transient errors (network, timeouts)
- ✅ Log retry attempts for debugging

### Batch Processing with Rate Limiting

**Real-world scenario:** Process multiple items without overwhelming the system.

```typescript
// app/lib/batch-processor.server.ts
import pLimit from 'p-limit';

export async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number = 5
): Promise<R[]> {
  const limit = pLimit(concurrency);
  
  const results = await Promise.allSettled(
    items.map(item => 
      limit(() => processor(item))
    )
  );
  
  const successful: R[] = [];
  const failed: Array<{ item: T; error: Error }> = [];
  
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      successful.push(result.value);
    } else {
      failed.push({
        item: items[index],
        error: result.reason instanceof Error 
          ? result.reason 
          : new Error(String(result.reason))
      });
    }
  });
  
  // Log failures but don't throw
  if (failed.length > 0) {
    console.error(`Failed to process ${failed.length} items:`, failed);
  }
  
  return successful;
}

// Usage: Bulk publish posts
export async function bulkPublishPosts(postIds: string[]) {
  return processBatch(
    postIds,
    async (postId) => {
      return await publishPost(postId);
    },
    5 // Process 5 at a time
  );
}
```

**Common pitfalls:**
- ❌ Processing all items at once (can crash system)
- ❌ Not handling partial failures
- ✅ Use concurrency limits
- ✅ Handle failures gracefully
- ✅ Log errors for debugging

### Transaction Management

**Real-world scenario:** Ensure data consistency across multiple operations.

```typescript
// app/features/posts/services/scheduling.server.ts
import { prisma } from "~/lib/prisma.server";

export async function schedulePostWithQueue(
  postId: string,
  queueId: string,
  scheduledAt: Date
) {
  // Use transaction to ensure consistency
  return await prisma.$transaction(async (tx) => {
    // 1. Update post
    const post = await tx.post.update({
      where: { id: postId },
      data: {
        queueId,
        scheduledAt,
        status: 'SCHEDULED',
      },
    });
    
    // 2. Create queue job
    await createQueueJob(tx, {
      postId,
      scheduledAt,
    });
    
    // 3. Update queue stats
    await tx.queue.update({
      where: { id: queueId },
      data: {
        scheduledCount: { increment: 1 },
      },
    });
    
    return post;
  });
}

// Common pitfalls:
// ❌ Not using transactions (data inconsistency)
// ❌ Long-running transactions (locks database)
// ✅ Keep transactions short
// ✅ Handle rollback on errors
```

### Caching with Invalidation

**Real-world scenario:** Cache frequently accessed data and invalidate on updates.

```typescript
// app/lib/cache.server.ts
import { redis } from "~/lib/redis.server";

const CACHE_TTL = 3600; // 1 hour

export async function getCachedUser(userId: string) {
  const cacheKey = `user:${userId}`;
  
  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // Cache miss - fetch from database
  const user = await getUserById(userId);
  
  // Cache for 1 hour
  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(user));
  
  return user;
}

export async function invalidateUserCache(userId: string) {
  const cacheKey = `user:${userId}`;
  await redis.del(cacheKey);
}

// Usage: Invalidate on update
export async function updateUser(userId: string, data: UserUpdate) {
  const user = await updateUserInDatabase(userId, data);
  
  // Invalidate cache
  await invalidateUserCache(userId);
  
  return user;
}

// Common pitfalls:
// ❌ Not invalidating cache on updates (stale data)
// ❌ Cache keys not unique (collisions)
// ❌ TTL too long (outdated data)
// ✅ Invalidate on writes
// ✅ Use unique cache keys
// ✅ Set appropriate TTLs
```

### Async Queue Processing

**Real-world scenario:** Process jobs asynchronously with proper error handling.

```typescript
// app/features/posts/workers/post-publisher.worker.ts
import { Worker, Job } from "bullmq";
import { redis } from "~/lib/redis.server";
import { publishPost } from "~/features/posts/services/publishing.server";
import { updatePostStatus } from "~/features/posts";

const worker = new Worker(
  "post-publish",
  async (job: Job) => {
    const { postId } = job.data;
    
    try {
      // Update status to processing
      await updatePostStatus(postId, "PROCESSING");
      
      // Publish post
      await publishPost(postId);
      
      // Update status to posted
      await updatePostStatus(postId, "POSTED");
      
      return { success: true, postId };
    } catch (error) {
      // Update status to failed
      await updatePostStatus(postId, "FAILED");
      
      // Log error
      console.error(`Failed to publish post ${postId}:`, error);
      
      // Re-throw to trigger retry
      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000, // 10 jobs per second
    },
  }
);

// Event handlers
worker.on("completed", (job) => {
  console.log(`Post ${job.data.postId} published successfully`);
});

worker.on("failed", (job, err) => {
  console.error(`Post ${job?.data?.postId} failed:`, err);
  
  // Send alert if too many failures
  if (job?.attemptsMade && job.attemptsMade >= 3) {
    sendAlert(`Post ${job.data.postId} failed after 3 attempts`);
  }
});

// Common pitfalls:
// ❌ Not handling errors (jobs stuck)
// ❌ No rate limiting (overwhelm services)
// ❌ Not updating status (unclear state)
// ✅ Handle all errors
// ✅ Implement rate limiting
// ✅ Update status throughout process
```

### Validation and Sanitization

**Real-world scenario:** Validate and sanitize user input before processing.

```typescript
// app/lib/validation.server.ts
import { z } from "zod";

// Define schema
const PostSchema = z.object({
  content: z.string()
    .min(1, "Content cannot be empty")
    .max(5000, "Content too long")
    .refine(
      (val) => val.trim().length > 0,
      "Content cannot be only whitespace"
    ),
  scheduledAt: z.date().optional(),
  queueId: z.string().uuid().optional(),
});

// Validate function
export function validatePost(data: unknown) {
  try {
    return PostSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(
        "Invalid post data",
        error.errors
      );
    }
    throw error;
  }
}

// Sanitize content
export function sanitizeContent(content: string): string {
  // Remove potentially dangerous HTML
  return content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .trim();
}

// Usage in route
export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const body = await request.json();
  
  // Validate
  const validated = validatePost(body);
  
  // Sanitize
  const sanitized = {
    ...validated,
    content: sanitizeContent(validated.content),
  };
  
  // Create post
  const post = await createPost({
    userId,
    ...sanitized,
  });
  
  return json({ post });
}

// Common pitfalls:
// ❌ Not validating input (security risk)
// ❌ Not sanitizing content (XSS risk)
// ❌ Trusting client data
// ✅ Always validate server-side
// ✅ Sanitize user content
// ✅ Use schema validation
```

---

## Best Practices Summary

### Do's ✅

1. **Error Handling:**
   - Always handle errors
   - Implement retry logic for transient errors
   - Log errors for debugging
   - Provide meaningful error messages

2. **Performance:**
   - Use pagination for large datasets
   - Implement caching for frequent queries
   - Batch operations when possible
   - Use transactions for consistency

3. **Security:**
   - Validate all input
   - Sanitize user content
   - Use parameterized queries
   - Implement rate limiting

4. **Code Quality:**
   - Use TypeScript for type safety
   - Write tests for critical paths
   - Document complex logic
   - Follow consistent patterns

### Don'ts ❌

1. **Error Handling:**
   - Don't ignore errors
   - Don't retry on all errors
   - Don't expose internal errors to users

2. **Performance:**
   - Don't fetch all records at once
   - Don't cache without invalidation
   - Don't create N+1 queries

3. **Security:**
   - Don't trust client input
   - Don't skip validation
   - Don't expose sensitive data

4. **Code Quality:**
   - Don't use `any` types
   - Don't duplicate code
   - Don't skip error handling

---

## Related Documentation

- [Developer Guide](../guides/developer-guide.md) - Development workflow
- [API Development Guide](../guides/api-development.md) - Building API endpoints
- [Architecture Overview](../getting-started/architecture.md) - System design
- [Recipes](./recipes.md) - Common use case patterns

---

**Next:** [Recipes](./recipes.md) → Common use case patterns

