# Performance Optimization Guide

This guide covers performance optimization strategies for SmartFlowSocial.

## Table of Contents

- [Overview](#overview)
- [Database Optimization](#database-optimization)
- [Caching Strategies](#caching-strategies)
- [Frontend Performance](#frontend-performance)
- [API Optimization](#api-optimization)
- [Image Optimization](#image-optimization)
- [Load Testing](#load-testing)
- [Performance Monitoring](#performance-monitoring)
- [Best Practices](#best-practices)

---

## Overview

SmartFlowSocial performance goals:

- **Response Time**: P95 < 500ms, P99 < 1s
- **Throughput**: Handle 100+ requests/second
- **Database Queries**: < 100ms average
- **Frontend Load**: First Contentful Paint < 1.5s
- **Image Loading**: Optimized and lazy-loaded

---

## Database Optimization

### Query Optimization

#### 1. Use Indexes

Add indexes for frequently queried columns:

```sql
-- Example: Index on user_id for posts
CREATE INDEX idx_posts_user_id ON posts(user_id);

-- Example: Index on scheduled_for for scheduled posts
CREATE INDEX idx_posts_scheduled_for ON posts(scheduled_for) WHERE is_scheduled = true;

-- Example: Composite index
CREATE INDEX idx_posts_user_scheduled ON posts(user_id, scheduled_for) WHERE is_scheduled = true;
```

#### 2. Avoid N+1 Queries

**❌ Bad: N+1 Query Problem**

```typescript
const posts = await getPosts();
for (const post of posts) {
  const user = await getUserById(post.userId); // N queries!
}
```

**✅ Good: Batch Queries**

```typescript
const posts = await getPosts();
const userIds = [...new Set(posts.map((p) => p.userId))];
const users = await getUsersByIds(userIds); // 1 query

const userMap = new Map(users.map((u) => [u.id, u]));
posts.forEach((post) => {
  post.user = userMap.get(post.userId);
});
```

#### 3. Use Select to Limit Fields

**❌ Bad: Fetch All Fields**

```typescript
const posts = await prisma.post.findMany({
  where: { userId },
});
```

**✅ Good: Select Only Needed Fields**

```typescript
const posts = await prisma.post.findMany({
  where: { userId },
  select: {
    id: true,
    content: true,
    scheduledFor: true,
    // Only select what you need
  },
});
```

#### 4. Pagination

Always paginate large result sets:

```typescript
const posts = await prisma.post.findMany({
  where: { userId },
  take: 20, // Limit
  skip: (page - 1) * 20, // Offset
  orderBy: { createdAt: "desc" },
});
```

#### 5. Use Database Views

For complex queries, create views:

```sql
CREATE VIEW user_post_summary AS
SELECT
  u.id as user_id,
  COUNT(p.id) as total_posts,
  COUNT(CASE WHEN p.is_posted THEN 1 END) as posted_count
FROM users u
LEFT JOIN posts p ON p.user_id = u.id
GROUP BY u.id;
```

### Connection Pooling

Configure Prisma connection pool:

```env
# In DATABASE_URL or prisma schema
DATABASE_URL=postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=20
```

Or in `schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // Connection pool settings
}
```

---

## Caching Strategies

### 1. Application-Level Caching

Cache frequently accessed data:

```typescript
import { LRUCache } from "lru-cache";

const cache = new LRUCache<string, any>({
  max: 500, // Max items
  ttl: 1000 * 60 * 5, // 5 minutes
});

export async function getCachedUser(userId: string) {
  const cacheKey = `user:${userId}`;

  // Check cache
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  // Fetch from database
  const user = await getUserById(userId);

  // Store in cache
  cache.set(cacheKey, user);

  return user;
}
```

### 2. Redis Caching

For distributed caching:

```typescript
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL!);

export async function getCachedData(key: string) {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const data = await fetchData();
  await redis.setex(key, 300, JSON.stringify(data)); // 5 min TTL

  return data;
}
```

### 3. HTTP Caching

Set appropriate cache headers:

```typescript
// In loader
export async function loader({ request }: LoaderFunctionArgs) {
  const data = await getData();

  return json(data, {
    headers: {
      "Cache-Control": "public, max-age=300", // 5 minutes
    },
  });
}
```

### 4. Static Asset Caching

Configure in `server.ts`:

```typescript
// Cache build assets forever (fingerprinted)
app.use("/build", express.static("public/build", { immutable: true, maxAge: "1y" }));

// Cache other static assets
app.use(express.static("public", { maxAge: "1h" }));
```

---

## Frontend Performance

### 1. Code Splitting

Remix automatically code-splits routes. For additional splitting:

```typescript
// Lazy load heavy components
const HeavyComponent = lazy(() => import('./HeavyComponent'));

function MyRoute() {
  return (
    <Suspense fallback={<Loading />}>
      <HeavyComponent />
    </Suspense>
  );
}
```

### 2. Image Optimization

**Lazy Loading:**

```tsx
<img src={imageUrl} loading="lazy" alt="Description" />
```

**Responsive Images:**

```tsx
<img
  src={imageUrl}
  srcSet={`${imageUrl}?w=400 400w, ${imageUrl}?w=800 800w`}
  sizes="(max-width: 768px) 400px, 800px"
  alt="Description"
/>
```

**Image Formats:**

- Use WebP for better compression
- Provide fallbacks for older browsers
- Optimize images before upload

### 3. Bundle Size Optimization

**Analyze Bundle:**

```bash
pnpm build
# Check build output for large bundles
```

**Reduce Dependencies:**

- Remove unused dependencies
- Use tree-shaking
- Import only what you need

**Example:**

```typescript
// ❌ Bad: Import entire library
import _ from "lodash";
// ✅ Good: Import specific function
import debounce from "lodash/debounce";
```

### 4. Memoization

Memoize expensive computations:

```tsx
import { useMemo } from "react";

function ExpensiveComponent({ data }) {
  const processedData = useMemo(() => {
    return expensiveComputation(data);
  }, [data]);

  return <div>{processedData}</div>;
}
```

### 5. Virtual Scrolling

For long lists, use virtual scrolling:

```tsx
// eslint-disable-next-line import/no-unresolved
import { FixedSizeList } from "react-window";

function PostList({ posts }) {
  return (
    <FixedSizeList height={600} itemCount={posts.length} itemSize={100} width="100%">
      {({ index, style }) => (
        <div style={style}>
          <PostItem post={posts[index]} />
        </div>
      )}
    </FixedSizeList>
  );
}
```

---

## API Optimization

### 1. Batch Requests

Combine multiple requests:

```typescript
// ❌ Bad: Multiple requests
const posts = await fetch("/api/posts");
const user = await fetch("/api/user");
const settings = await fetch("/api/settings");

// ✅ Good: Single request
const data = await fetch("/api/dashboard"); // Returns all data
```

### 2. Compression

Enable gzip compression:

```typescript
import compression from "compression";

app.use(compression());
```

### 3. Response Streaming

For large responses, use streaming:

```typescript
export async function loader({ request }: LoaderFunctionArgs) {
  const stream = new ReadableStream({
    async start(controller) {
      // Stream data as it becomes available
      for await (const item of fetchData()) {
        controller.enqueue(JSON.stringify(item));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/json" },
  });
}
```

### 4. Rate Limiting

Prevent abuse and ensure fair resource usage:

```typescript
import rateLimit from "express-rate-limit";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests
});

app.use("/api/", limiter);
```

---

## Image Optimization

### 1. Image Compression

Compress images before upload:

```typescript
import sharp from "sharp";

async function compressImage(file: File) {
  const buffer = await file.arrayBuffer();

  return await sharp(Buffer.from(buffer))
    .resize(1920, 1080, { fit: "inside" })
    .webp({ quality: 80 })
    .toBuffer();
}
```

### 2. Multiple Sizes

Generate multiple sizes:

```typescript
async function generateImageSizes(file: File) {
  const sizes = [400, 800, 1200, 1920];
  const images = await Promise.all(
    sizes.map((size) =>
      sharp(buffer).resize(size, size, { fit: "inside" }).webp({ quality: 80 }).toBuffer()
    )
  );

  return images;
}
```

### 3. Lazy Loading

Lazy load images below the fold:

```tsx
<img
  src={placeholder}
  data-src={imageUrl}
  loading="lazy"
  onLoad={(e) => {
    e.currentTarget.src = e.currentTarget.dataset.src!;
  }}
/>
```

### 4. CDN Usage

Use CDN for image delivery:

- Faster delivery
- Reduced server load
- Better caching
- Geographic distribution

---

## Load Testing

### Running Load Tests

```bash
# Run performance tests
pnpm test:performance

# k6 load tests
k6 run tests/performance/load-test.js
```

### Performance Benchmarks

Target metrics:

- **Response Time**: P95 < 500ms
- **Error Rate**: < 1%
- **Throughput**: 100+ req/s
- **Concurrent Users**: 1000+

### Load Test Example

```javascript
// tests/performance/load-test.js
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "30s", target: 50 },
    { duration: "1m", target: 100 },
    { duration: "30s", target: 0 },
  ],
};

export default function () {
  const res = http.get("https://your-domain.com/healthcheck");
  check(res, {
    "status is 200": (r) => r.status === 200,
    "response time < 500ms": (r) => r.timings.duration < 500,
  });
  sleep(1);
}
```

---

## Performance Monitoring

### Key Metrics

Monitor these metrics:

1. **Response Time**
   - P50, P95, P99 percentiles
   - Average response time
   - Slowest endpoints

2. **Throughput**
   - Requests per second
   - Successful requests
   - Failed requests

3. **Resource Usage**
   - CPU usage
   - Memory usage
   - Database connections
   - Redis memory

4. **Error Rate**
   - 4xx errors
   - 5xx errors
   - Timeout errors

### Monitoring Tools

1. **Prometheus + Grafana**
   - Metrics collection
   - Visualization
   - Alerting

2. **Application Performance Monitoring (APM)**
   - New Relic
   - Datadog
   - Sentry Performance

3. **Log Analysis**
   - ELK Stack
   - Datadog Logs
   - CloudWatch Logs

### Setting Up Monitoring

See [Operations Guide](./operations.md) for detailed monitoring setup.

---

## Best Practices

### 1. Database

- ✅ Use indexes on frequently queried columns
- ✅ Avoid N+1 queries
- ✅ Use pagination for large datasets
- ✅ Select only needed fields
- ✅ Use connection pooling
- ✅ Monitor slow queries

### 2. Caching

- ✅ Cache frequently accessed data
- ✅ Set appropriate TTLs
- ✅ Invalidate cache on updates
- ✅ Use HTTP caching headers
- ✅ Cache static assets

### 3. Frontend

- ✅ Code split routes
- ✅ Lazy load images
- ✅ Optimize bundle size
- ✅ Use memoization
- ✅ Virtual scroll long lists

### 4. API

- ✅ Batch requests when possible
- ✅ Enable compression
- ✅ Use rate limiting
- ✅ Optimize response size
- ✅ Stream large responses

### 5. Images

- ✅ Compress before upload
- ✅ Generate multiple sizes
- ✅ Use modern formats (WebP)
- ✅ Lazy load images
- ✅ Use CDN for delivery

### 6. Monitoring

- ✅ Monitor key metrics
- ✅ Set up alerts
- ✅ Regular performance reviews
- ✅ Load test before releases
- ✅ Track performance trends

---

## Performance Checklist

### Pre-Deployment

- [ ] Database indexes created
- [ ] N+1 queries eliminated
- [ ] Pagination implemented
- [ ] Caching configured
- [ ] Images optimized
- [ ] Bundle size optimized
- [ ] Load tests passed
- [ ] Monitoring configured

### Regular Maintenance

- [ ] Review slow queries weekly
- [ ] Check cache hit rates
- [ ] Monitor response times
- [ ] Review error rates
- [ ] Optimize based on metrics

---

## Additional Resources

- [Operations Guide](./operations.md) - Monitoring setup
- [Deployment Guide](./deployment.md) - Production deployment
- [Database Schema](./database-schema.md) - Database structure
- [Architecture](./architecture.md) - System architecture
