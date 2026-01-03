# Performance Optimization

**Estimated time:** 40 minutes  
**Difficulty:** Advanced  
**Last updated:** 2026-01-02

Learn how to optimize SmartFlowSocial performance, scale efficiently, and monitor system health.

---

## Prerequisites

- ✅ Understanding of system architecture
- ✅ Access to server/deployment environment
- ✅ Basic knowledge of databases and caching
- ✅ Completed [Developer Guide](../../guides/developer-guide.md)

---

## Overview

**Performance optimization involves:**

- Database query optimization
- Caching strategies
- Frontend performance
- API optimization
- Scaling techniques
- Monitoring and alerting

---

## Database Optimization

### Query Optimization

**Identify slow queries:**

```sql
-- Enable slow query logging
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

**Add indexes:**

```sql
-- Index on frequently queried columns
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_scheduled_for ON posts(scheduled_for)
  WHERE is_scheduled = true;

-- Composite index for common queries
CREATE INDEX idx_posts_user_scheduled ON posts(user_id, scheduled_for)
  WHERE is_scheduled = true;
```

### Avoid N+1 Queries

**Problem:**

```typescript
// ❌ Bad: N+1 queries
const posts = await getPosts();
for (const post of posts) {
  const user = await getUserById(post.userId); // N queries!
}
```

**Solution:**

```typescript
// ✅ Good: Batch query
const posts = await getPosts();
const userIds = [...new Set(posts.map((p) => p.userId))];
const users = await getUsersByIds(userIds); // 1 query

const userMap = new Map(users.map((u) => [u.id, u]));
posts.forEach((post) => {
  post.user = userMap.get(post.userId);
});
```

### Pagination

**Implement pagination:**

```typescript
// ✅ Good: Paginated query
const posts = await prisma.post.findMany({
  where: { userId },
  take: 20,
  skip: page * 20,
  orderBy: { createdAt: "desc" },
});
```

---

## Caching Strategies

### Redis Caching

**Cache frequently accessed data:**

```typescript
import { redis } from "./redis";

async function getCachedUser(userId: string) {
  const cacheKey = `user:${userId}`;

  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Fetch from database
  const user = await getUserById(userId);

  // Cache for 1 hour
  await redis.setex(cacheKey, 3600, JSON.stringify(user));

  return user;
}
```

### HTTP Caching

**Set cache headers:**

```typescript
export async function loader({ request }: LoaderFunctionArgs) {
  const data = await loadData();

  return json(data, {
    headers: {
      "Cache-Control": "public, max-age=300", // 5 minutes
    },
  });
}
```

---

## Frontend Performance

### Code Splitting

**Split routes:**

```typescript
// Lazy load routes
const Dashboard = lazy(() => import("./routes/dashboard"));
const Settings = lazy(() => import("./routes/settings"));
```

### Image Optimization

**Lazy load images:**

```typescript
<img
  src={imageUrl}
  loading="lazy"
  alt="Post image"
/>
```

**Optimize images:**

- Compress before upload
- Use WebP format
- Generate multiple sizes
- Use CDN for delivery

### Bundle Optimization

**Analyze bundle:**

```bash
npm run build -- --analyze
```

**Optimize:**

- Remove unused dependencies
- Use tree shaking
- Code split routes
- Minimize bundle size

---

## API Optimization

### Request Batching

**Batch multiple requests:**

```typescript
async function batchRequests(requests: Request[]) {
  return Promise.all(requests);
}
```

### Response Compression

**Enable compression:**

```typescript
import compression from "compression";

app.use(compression());
```

### Rate Limiting

**Implement rate limiting:**

```typescript
import rateLimit from "express-rate-limit";

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests
});

app.use("/api/", apiLimiter);
```

---

## Queue Performance

### Queue Optimization

**Optimize queue processing:**

1. **Batch job processing:**

   - Process multiple jobs together
   - Reduce overhead
   - Improve throughput

2. **Worker scaling:**

   - Add more workers
   - Distribute load
   - Handle peak times

3. **Queue monitoring:**
   - Track queue length
   - Monitor processing time
   - Identify bottlenecks

### Job Optimization

**Optimize individual jobs:**

```typescript
// ✅ Good: Efficient job
async function processPostJob(job: Job) {
  const { postId } = job.data;

  // Fetch only needed data
  const post = await getPostById(postId, {
    select: ["id", "content", "scheduledFor"],
  });

  // Process efficiently
  await publishPost(post);
}
```

---

## Scaling Strategies

### Horizontal Scaling

**Scale application servers:**

1. **Load balancing:**

   - Use reverse proxy (nginx)
   - Distribute requests
   - Handle failover

2. **Stateless design:**
   - No server-side state
   - Session in database/Redis
   - Horizontal scaling ready

### Database Scaling

**Scale database:**

1. **Read replicas:**

   - Separate read/write
   - Distribute read load
   - Improve performance

2. **Connection pooling:**
   - Reuse connections
   - Limit connections
   - Optimize pool size

### Caching Layer

**Add caching:**

1. **Redis cache:**

   - Frequently accessed data
   - Session storage
   - Queue backend

2. **CDN:**
   - Static assets
   - Image delivery
   - Global distribution

---

## Monitoring

### Key Metrics

**Monitor these metrics:**

1. **Response time:**

   - P50, P95, P99
   - Average response time
   - Slowest endpoints

2. **Throughput:**

   - Requests per second
   - Jobs processed per minute
   - Success rate

3. **Resource usage:**

   - CPU usage
   - Memory usage
   - Database connections
   - Redis memory

4. **Error rate:**
   - 4xx errors
   - 5xx errors
   - Timeout errors

### Monitoring Tools

**Application monitoring:**

- Prometheus + Grafana
- Datadog APM
- New Relic
- Sentry Performance

**Database monitoring:**

- PostgreSQL stats
- Slow query logs
- Connection monitoring
- Index usage

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

## Troubleshooting

### Slow Performance

**Identify bottlenecks:**

- Check database queries
- Review API response times
- Analyze frontend load
- Monitor resource usage

**Solutions:**

- Add indexes
- Optimize queries
- Implement caching
- Scale resources

### High Memory Usage

**Identify causes:**

- Memory leaks
- Large datasets
- Inefficient queries
- Caching issues

**Solutions:**

- Fix memory leaks
- Implement pagination
- Optimize queries
- Adjust cache TTLs

---

## What You Learned

✅ Database optimization techniques  
✅ Caching strategies  
✅ Frontend performance optimization  
✅ API optimization  
✅ Scaling strategies  
✅ Monitoring and alerting

---

## Next Steps

1. **[Operations Guide](../../guides/operations.md)** - Production operations
2. **[Deployment Guide](../../guides/deployment.md)** - Production deployment
3. **[Developer Guide](../../guides/developer-guide.md)** - Development workflow

---

## Related Documentation

- [Performance Reference](../../reference/performance.md) - Complete performance guide
- [Operations Guide](../../guides/operations.md) - Monitoring setup
- [Architecture Guide](../../getting-started/architecture.md) - System architecture

---

**Tutorials Complete!** Return to [Tutorials Index](../README.md) for more learning paths.

