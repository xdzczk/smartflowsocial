# Code Samples

**Last updated:** 2026-01-03

Working code examples for common SmartFlowSocial development tasks.

---

## Architecture Pattern

SmartFlowSocial follows a **layered architecture**:

1. **Routes** (`app/routes/*`) - HTTP handling, use feature public APIs
2. **Features** (`app/features/*`) - Business logic, expose public APIs via `index.ts`
3. **Models** (`app/models/*`) - Database access, used internally by features

**✅ DO:** Import from feature public APIs
```typescript
import { loadDashboardData } from "~/features/posts";
import { requireUserId } from "~/features/auth";
```

**❌ DON'T:** Import from models or feature internals
```typescript
import { createPost } from "~/models/post.commands.server"; // ❌ Bad
import { getPosts } from "~/features/posts/services/..."; // ❌ Bad
```

See [Architecture Overview](../getting-started/architecture.md) for details.

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

### Using Models (Internal Layer)

**Note:** Models are internal to features. Routes should use feature public APIs, not models directly.

```typescript
// app/models/post.commands.server.ts
// This is the model layer - used internally by features
import type { CreatePostData } from "./post.types";
import { prisma } from "~/lib/prisma.server";

export function createPost(data: CreatePostData): Promise<Post> {
  // Actual implementation uses CreatePostData type with all required fields
  return prisma.post.create({
    data: {
      content: data.content,
      fileUrl: data.fileUrl,
      scheduledFor: data.scheduledFor?.toString(),
      postType: data.postType,
      tags: data.tags,
      isScheduled: data.isScheduled,
      isPosted: data.isPosted,
      // ... other fields
      user: {
        connect: { id: data.userId },
      },
    },
  });
}
```

```typescript
// app/models/post.queries.server.ts
// Query operations (reads only)
import { prisma } from "~/lib/prisma.server";

export function getScheduledPosts({
  userId,
  queueType,
}: {
  userId: string;
  queueType?: string;
}): Promise<PostWithQueueType[]> {
  const whereClause = {
    isScheduled: true,
    isPosted: false,
    draft: false,
    userId: userId,
    ...(queueType && queueType !== "all" && {
      queueType: { name: queueType },
    }),
  };

  return prisma.post.findMany({
    where: whereClause,
    include: {
      queueType: true,
      hashTagPreset: true,
      template: true,
    },
    orderBy: { scheduledFor: "asc" },
  });
}
```

### Using Features (Recommended Pattern)

**Routes should use feature public APIs, not models directly:**

```typescript
// app/routes/dashboard.posts.tsx
import { loadDashboardData } from "~/features/posts";
import { requireUserId } from "~/features/auth";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const url = new URL(request.url);
  const queueType = url.searchParams.get("queueType") || "all";

  // Use feature public API, not models directly
  const data = await loadDashboardData(userId, queueType);
  return json(data);
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
import { loadDashboardData } from "~/features/posts";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const url = new URL(request.url);

  // Parse query parameters
  const queueType = url.searchParams.get("queueType") || "all";

  // Use feature loader (handles data fetching, business logic)
  const data = await loadDashboardData(userId, queueType);

  return json(data);
}
```

### POST Endpoint

```typescript
// app/routes/api.posts.tsx
import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { requireUserId } from "~/features/auth";
import { ValidationError } from "~/lib/errors";
import { handleNewPostAction } from "~/features/posts";

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  // Use feature action handler (handles validation, business logic, etc.)
  return handleNewPostAction({ request, userId });
}
```

**Note:** In practice, post creation goes through feature action handlers that:
- Validate input
- Resolve queue types
- Handle business logic
- Call models internally
- Return appropriate responses

---

## Queue Operations

### Schedule Post (Using Queue Abstraction)

```typescript
// app/features/posts/services/scheduling.server.ts
import { enqueuePostJob } from "~/infra/queue";
import type { PostJobData } from "~/infra/queue";

export async function schedulePost(
  postId: string,
  userId: string,
  signedEvent: SignedEvent,
  scheduledAt: Date,
) {
  const delay = scheduledAt.getTime() - Date.now();

  // Use queue abstraction layer (not BullMQ directly)
  await enqueuePostJob({
    postId,
    userId,
    signedEvent,
    scheduledAt: scheduledAt.toISOString(),
  }, {
    delay: Math.max(0, delay), // Ensure non-negative
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
  });
}
```

### Process Queue Job (Worker Implementation)

```typescript
// app/features/posts/queues.server.ts
import { Worker } from "bullmq";
import { getQueueInstance, redis } from "~/infra/queue";
import type { PostJobData } from "~/infra/queue";

// Get queue instance using abstraction
const scheduledPostsQueue = getQueueInstance("scheduled-posts");

// Worker processes scheduled posts
export const scheduledPostsWorker = new Worker<PostJobData>(
  "scheduled-posts",
  async (job) => {
    const { postId, userId, signedEvent } = job.data;
    
    // Publish to Nostr via HTTP Publisher
    await publishPostToNostr(signedEvent);
    
    // Update post status
    await updatePostStatus(postId, { isPosted: true });
  },
  {
    connection: redis,
    concurrency: 5,
  },
);

// Event handlers
scheduledPostsWorker.on("completed", (job) => {
  console.log(`Post ${job.data.postId} published successfully`);
});

scheduledPostsWorker.on("failed", (job, err) => {
  console.error(`Post ${job?.data?.postId} failed:`, err);
});
```

**Note:** Workers are initialized in `worker.ts` and automatically started when the module loads.

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
    }),
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
import { getPostById } from "~/models/post.queries.server";
import { updatePost } from "~/models/post.commands.server";

export async function publishPost(postId: string) {
  // Get post from model (read)
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
      relays: post.relays || [],
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to publish");
  }

  // Update post status using model (write)
  await updatePost({
    id: postId,
    data: {
      isPosted: true,
      postedAt: new Date(),
    },
  });
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
  initialDelay: number = 1000,
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
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

// Usage: Publishing with retry
export async function publishPostWithRetry(postId: string) {
  return retryWithBackoff(
    async () => {
      return await publishPost(postId);
    },
    3,
    1000,
  );
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
import pLimit from "p-limit";

export async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number = 5,
): Promise<R[]> {
  const limit = pLimit(concurrency);

  const results = await Promise.allSettled(
    items.map((item) => limit(() => processor(item))),
  );

  const successful: R[] = [];
  const failed: Array<{ item: T; error: Error }> = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      successful.push(result.value);
    } else {
      failed.push({
        item: items[index],
        error:
          result.reason instanceof Error
            ? result.reason
            : new Error(String(result.reason)),
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
    5, // Process 5 at a time
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
import { createPost } from "~/models/post.commands.server";
import { resolveQueueTypeId } from "./queue-type-resolver.server";

export async function schedulePostWithQueue(
  postId: string,
  queueTypeName: string,
  scheduledAt: Date,
) {
  // Use transaction to ensure consistency
  return await prisma.$transaction(async (tx) => {
    // 1. Resolve queue type ID (business logic)
    const queueTypeId = await resolveQueueTypeId(tx, queueTypeName);

    // 2. Update post (using model)
    const post = await tx.post.update({
      where: { id: postId },
      data: {
        queueTypeId,
        scheduledFor: scheduledAt.toString(),
        isScheduled: true,
      },
    });

    // 3. Schedule queue job (business logic)
    await scheduleQueueJob(postId, scheduledAt);

    return post;
  });
}

// Common pitfalls:
// ❌ Not using transactions (data inconsistency)
// ❌ Long-running transactions (locks database)
// ❌ Direct model access from routes (bypasses business logic)
// ✅ Keep transactions short
// ✅ Handle rollback on errors
// ✅ Use feature layer, not models directly
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
// app/features/posts/queues.server.ts
import { Worker, type Job } from "bullmq";
import { getQueueInstance, redis } from "~/infra/queue";
import type { PostJobData } from "~/infra/queue";
import { updatePostStatus } from "~/models/post.commands.server";
import { fetchWithRetry } from "~/lib/fetch.server";
import { env } from "~/lib/env.server";

const scheduledPostsQueue = getQueueInstance("scheduled-posts");

export const scheduledPostsWorker = new Worker<PostJobData>(
  "scheduled-posts",
  async (job: Job<PostJobData>) => {
    const { postId, userId, signedEvent } = job.data;

    try {
      // Idempotency check: verify post exists and is not already posted
      const existingPost = await prisma.post.findUnique({
        where: { id: postId, userId },
        select: { isPosted: true, nostrEventId: true },
      });

      if (existingPost?.isPosted) {
        console.log(`Post ${postId} already posted, skipping`);
        return { success: true, skipped: true };
      }

      // Publish to Nostr via HTTP Publisher
      const response = await fetchWithRetry(
        `${env.NOSTR_PUBLISHER_URL}/publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event: signedEvent }),
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to publish: ${response.statusText}`);
      }

      // Update post status to posted
      await updatePostStatus(postId, {
        isPosted: true,
        postedAt: new Date(),
      });

      return { success: true, postId };
    } catch (error) {
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
  },
);

// Event handlers
scheduledPostsWorker.on("completed", (job) => {
  console.log(`Post ${job.data.postId} published successfully`);
});

scheduledPostsWorker.on("failed", (job, err) => {
  console.error(`Post ${job?.data?.postId} failed:`, err);

  // Send alert if too many failures
  if (job?.attemptsMade && job.attemptsMade >= 3) {
    // Send alert logic here
    console.error(`Post ${job.data.postId} failed after 3 attempts`);
  }
});

// Common pitfalls:
// ❌ Not handling errors (jobs stuck)
// ❌ No rate limiting (overwhelm services)
// ❌ Not checking idempotency (duplicate posts)
// ✅ Handle all errors
// ✅ Implement rate limiting
// ✅ Check idempotency before processing
// ✅ Use queue abstraction layer, not BullMQ directly
```

### Validation and Sanitization

**Real-world scenario:** Validate and sanitize user input before processing.

```typescript
// app/lib/validation.server.ts
import { z } from "zod";

// Define schema
const PostSchema = z.object({
  content: z
    .string()
    .min(1, "Content cannot be empty")
    .max(5000, "Content too long")
    .refine(
      (val) => val.trim().length > 0,
      "Content cannot be only whitespace",
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
      throw new ValidationError("Invalid post data", error.errors);
    }
    throw error;
  }
}

// Sanitize content
export function sanitizeContent(content: string): string {
  // Remove potentially dangerous HTML
  return content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .trim();
}

// Usage in route - use feature action handler
export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  
  // Feature action handlers handle validation, sanitization, and business logic
  return handleNewPostAction({ request, userId });
}

// Or if you need custom validation in a feature service:
export async function createPostWithValidation(
  userId: string,
  data: unknown,
) {
  // Validate
  const validated = validatePost(data);

  // Sanitize
  const sanitized = {
    ...validated,
    content: sanitizeContent(validated.content),
  };

  // Resolve queue type (business logic)
  const queueTypeId = await resolveQueueTypeId(sanitized.queueTypeName);

  // Create post (using model)
  const post = await createPost({
    userId,
    ...sanitized,
    queueTypeId,
  });

  return post;
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
