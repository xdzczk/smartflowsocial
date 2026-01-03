# Performance Troubleshooting

**Estimated time:** 20 minutes  
**Difficulty:** Intermediate  
**Last updated:** 2026-01-02

Guide to identifying and resolving performance issues in SmartFlowSocial.

---

## Table of Contents

- [Identifying Performance Issues](#identifying-performance-issues)
- [Database Performance](#database-performance)
- [API Performance](#api-performance)
- [Frontend Performance](#frontend-performance)
- [Queue Performance](#queue-performance)
- [Optimization Strategies](#optimization-strategies)

---

## Identifying Performance Issues

### Symptoms

- **Slow page loads** - Pages take > 3 seconds to load
- **Timeout errors** - Requests timing out
- **High memory usage** - Application using excessive memory
- **Slow queries** - Database queries taking > 1 second
- **Queue backlog** - Jobs piling up in queue

### Monitoring Tools

1. **Application logs** - Check for slow operations
2. **Database logs** - Identify slow queries
3. **Browser DevTools** - Network and performance tabs
4. **Redis monitoring** - Queue status and length
5. **System monitoring** - CPU, memory, disk usage

---

## Database Performance

### Slow Queries

**Identify slow queries:**

```sql
-- Enable query logging
SET log_min_duration_statement = 1000; -- Log queries > 1s

-- View slow queries
SELECT
  query,
  calls,
  total_time,
  mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

**Common causes:**

- Missing indexes
- Full table scans
- Complex joins
- Large result sets

**Solutions:**

1. **Add indexes:**

```prisma
model Post {
  userId String
  scheduledAt DateTime?

  @@index([userId])
  @@index([scheduledAt])
  @@index([userId, scheduledAt]) // Composite index
}
```

2. **Limit result sets:**

```typescript
// ✅ Good: Pagination
const posts = await prisma.post.findMany({
  where: { userId },
  take: 20,
  skip: 0,
});

// ❌ Bad: Fetch all
const posts = await prisma.post.findMany({ where: { userId } });
```

3. **Select specific fields:**

```typescript
// ✅ Good: Select only needed fields
const posts = await prisma.post.findMany({
  select: { id: true, content: true },
});

// ❌ Bad: Fetch all fields
const posts = await prisma.post.findMany();
```

### Connection Pooling

**Configure connection pool:**

```typescript
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // Add connection pool settings
}
```

**Or in connection string:**

```
DATABASE_URL=postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=20
```

---

## API Performance

### Slow Endpoints

**Identify slow endpoints:**

```typescript
// Add timing
const start = Date.now();
const result = await processRequest();
const duration = Date.now() - start;
console.log(`Endpoint took ${duration}ms`);
```

**Optimization strategies:**

1. **Cache responses:**

```typescript
// Cache expensive operations
const cacheKey = `user:${userId}:posts`;
const cached = await cache.get(cacheKey);
if (cached) return json(cached);

const data = await fetchData(userId);
await cache.set(cacheKey, data, 3600); // 1 hour
return json(data);
```

2. **Parallel requests:**

```typescript
// ✅ Good: Parallel
const [posts, user, stats] = await Promise.all([
  getPosts(userId),
  getUser(userId),
  getStats(userId),
]);

// ❌ Bad: Sequential
const posts = await getPosts(userId);
const user = await getUser(userId);
const stats = await getStats(userId);
```

3. **Lazy load data:**

```typescript
// Load only what's needed
const posts = await getPosts(userId, { limit: 20 });
// Load more on demand
```

---

## Frontend Performance

### Slow Renders

**Identify issues:**

- Use React DevTools Profiler
- Check for unnecessary re-renders
- Identify slow components

**Optimization strategies:**

1. **Memoization:**

```typescript
import { useMemo } from "react";

const expensiveValue = useMemo(() => {
  return computeExpensiveValue(data);
}, [data]);
```

2. **Code splitting:**

```typescript
// Lazy load components
const HeavyComponent = lazy(() => import("./HeavyComponent"));

<Suspense fallback={<Loading />}>
  <HeavyComponent />
</Suspense>
```

3. **Optimize images:**

- Compress images before upload
- Use appropriate sizes
- Lazy load images

---

## Queue Performance

### Queue Backlog

**Check queue status:**

```bash
redis-cli -u $REDIS_URL

# Check queue length
LLEN bull:post-publish:wait

# Check active jobs
LLEN bull:post-publish:active

# Check failed jobs
LLEN bull:post-publish:failed
```

**Solutions:**

1. **Increase worker concurrency:**

```typescript
const worker = new Worker("post-publish", handler, {
  concurrency: 10, // Increase from default 1
});
```

2. **Scale workers:**

```bash
# Run multiple worker processes
pnpm start:worker &
pnpm start:worker &
pnpm start:worker &
```

3. **Process jobs in batches:**

```typescript
// Process multiple jobs at once
const jobs = await queue.getJobs(["waiting"], 0, 10);
await Promise.all(jobs.map((job) => processJob(job)));
```

---

## Optimization Strategies

### Database

1. **Add indexes** on frequently queried columns
2. **Use pagination** for large result sets
3. **Select specific fields** instead of all fields
4. **Use connection pooling** to manage connections
5. **Monitor query performance** regularly

### Application

1. **Cache expensive operations**
2. **Use parallel requests** where possible
3. **Optimize images** before upload
4. **Lazy load** non-critical data
5. **Monitor performance** metrics

### Infrastructure

1. **Scale horizontally** - Add more instances
2. **Use CDN** for static assets
3. **Optimize database** configuration
4. **Monitor resources** (CPU, memory, disk)
5. **Use caching** layers (Redis, CDN)

---

## Related Documentation

- [Common Issues](./common-issues.md) - Common problems
- [Debugging Guide](./debugging.md) - Debugging techniques
- [Performance Guide](../reference/performance.md) - Performance optimization

---

**Next:** [Common Issues](./common-issues.md) → Frequently asked questions


