# Debugging Guide

**Estimated time:** 20 minutes  
**Difficulty:** Intermediate  
**Last updated:** 2026-01-02

Techniques and tools for debugging SmartFlowSocial issues.

---

## Table of Contents

- [Debugging Tools](#debugging-tools)
- [Common Debugging Scenarios](#common-debugging-scenarios)
- [Log Analysis](#log-analysis)
- [Database Debugging](#database-debugging)
- [Queue Debugging](#queue-debugging)
- [Performance Debugging](#performance-debugging)

---

## Debugging Tools

### Browser DevTools

**Chrome/Edge DevTools:**

- **Console** - View logs and errors
- **Network** - Inspect HTTP requests
- **Application** - Check storage and cookies
- **React DevTools** - Inspect React components

**Firefox DevTools:**

- Similar features to Chrome
- Additional developer tools

### Node.js Inspector

**Start with inspector:**

```bash
node --inspect server.ts
```

**Connect:**

1. Open Chrome
2. Navigate to `chrome://inspect`
3. Click "inspect" on your Node.js process

**Debug:**

- Set breakpoints
- Step through code
- Inspect variables
- View call stack

### Prisma Studio

**Launch:**

```bash
pnpm exec prisma studio
```

**Access:**

- Opens at `http://localhost:5555`
- Browse database tables
- View and edit records
- Run queries

### Redis CLI

**Connect:**

```bash
redis-cli -u $REDIS_URL
```

**Commands:**

```bash
# List all keys
KEYS *

# Check queue
KEYS bull:*

# View queue length
LLEN bull:post-publish:wait

# Monitor commands
MONITOR
```

---

## Common Debugging Scenarios

### Post Not Publishing

**Symptoms:**

- Post shows as "Scheduled"
- Post doesn't appear on Nostr
- No errors in logs

**Debugging steps:**

1. **Check worker process:**

```bash
# Verify worker is running
ps aux | grep "start:worker"

# Check worker logs
# Look for errors or warnings
```

2. **Check queue:**

```bash
redis-cli -u $REDIS_URL
KEYS bull:*
# Check for stuck jobs
```

3. **Verify post data:**

```bash
# Check database
pnpm exec prisma studio
# Verify post has signedEvent
# Check scheduledAt timestamp
```

4. **Test Nostr Publisher:**

```bash
curl $NOSTR_PUBLISHER_URL/health
# Should return 200 OK
```

### Database Connection Issues

**Symptoms:**

- "Can't reach database server"
- Connection timeout
- Query failures

**Debugging steps:**

1. **Test connection:**

```bash
psql $DATABASE_URL -c "SELECT 1"
```

2. **Check PostgreSQL:**

```bash
# Verify PostgreSQL is running
pg_isready -h localhost

# Check logs
tail -f /var/log/postgresql/postgresql.log
```

3. **Verify credentials:**

```bash
# Check DATABASE_URL format
echo $DATABASE_URL
# Should be: postgresql://user:password@host:port/db
```

4. **Check network:**

```bash
# Test connectivity
telnet localhost 5432
# Or
nc -zv localhost 5432
```

### Authentication Failures

**Symptoms:**

- Login fails
- Session expires immediately
- "Unauthorized" errors

**Debugging steps:**

1. **Check session secret:**

```bash
# Verify SESSION_SECRET is set
echo $SESSION_SECRET
# Should be 32+ characters
```

2. **Check cookies:**

```javascript
// In browser console
document.cookie;
// Should see session cookie
```

3. **Check Nostr extension:**

```javascript
// In browser console
window.nostr;
// Should be defined
```

4. **Review authentication flow:**

- Check server logs
- Verify extension permissions
- Test with different extension

---

## Log Analysis

### Application Logs

**View logs:**

```bash
# Development
pnpm dev
# Logs appear in terminal

# Production
# Check application logs
tail -f /var/log/app.log
```

**Log levels:**

- **ERROR** - Critical errors
- **WARN** - Warnings
- **INFO** - Informational
- **DEBUG** - Debug information

### Worker Logs

**View worker logs:**

```bash
# Development
pnpm start:worker
# Logs appear in terminal

# Production
# Check worker logs
tail -f /var/log/worker.log
```

**Common log patterns:**

- Job completion: `Job {id} completed`
- Job failure: `Job {id} failed: {error}`
- Queue processing: `Processing job {id}`

### Database Logs

**PostgreSQL logs:**

```bash
# Check PostgreSQL logs
tail -f /var/log/postgresql/postgresql.log

# Enable query logging
# In postgresql.conf:
log_statement = 'all'
```

---

## Database Debugging

### Query Performance

**Enable query logging:**

```typescript
// In Prisma client
const prisma = new PrismaClient({
  log: ["query", "info", "warn", "error"],
});
```

**Analyze slow queries:**

```sql
-- Find slow queries
SELECT
  query,
  calls,
  total_time,
  mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

### Data Inspection

**Prisma Studio:**

```bash
pnpm exec prisma studio
# Browse tables, view data
```

**Direct SQL:**

```bash
psql $DATABASE_URL
# Run queries directly
```

---

## Queue Debugging

### Check Queue Status

```bash
redis-cli -u $REDIS_URL

# List all queues
KEYS bull:*

# Check queue length
LLEN bull:post-publish:wait

# View job details
HGETALL bull:post-publish:{jobId}
```

### Monitor Queue

```bash
# Monitor Redis commands
redis-cli -u $REDIS_URL MONITOR

# Watch for queue operations
# See jobs being added/processed
```

### Stuck Jobs

**Identify stuck jobs:**

```bash
# Check for jobs in "active" state too long
# Review worker logs for errors
```

**Clear stuck jobs:**

```typescript
// In worker code
await queue.clean(0, 100, "active");
```

---

## Performance Debugging

### Identify Bottlenecks

1. **Database queries:**

   - Enable query logging
   - Identify slow queries
   - Add indexes

2. **API endpoints:**

   - Measure response times
   - Identify slow endpoints
   - Optimize queries

3. **Frontend:**
   - Use React DevTools Profiler
   - Identify slow renders
   - Optimize components

### Performance Monitoring

**Add timing:**

```typescript
const start = Date.now();
await expensiveOperation();
const duration = Date.now() - start;
console.log(`Operation took ${duration}ms`);
```

**Use performance API:**

```typescript
performance.mark("start");
await operation();
performance.mark("end");
performance.measure("operation", "start", "end");
```

---

## Related Documentation

- [Common Issues](./common-issues.md) - Frequently asked questions
- [Performance Troubleshooting](./performance.md) - Performance issues
- [Developer Guide](../guides/developer-guide.md) - Development workflow

---

**Next:** [Performance Troubleshooting](./performance.md) → Performance debugging

