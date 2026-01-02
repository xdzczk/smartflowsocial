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

## Related Documentation

- [Developer Guide](../guides/developer-guide.md) - Development workflow
- [API Development Guide](../guides/api-development.md) - Building API endpoints
- [Architecture Overview](../getting-started/architecture.md) - System design

---

**Next:** [Recipes](./recipes.md) → Common use case patterns

