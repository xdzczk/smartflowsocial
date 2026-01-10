# Error Troubleshooting Guide

**Last updated:** 2026-01-03

This guide helps you diagnose and resolve errors and issues with SmartFlowSocial, including
debugging techniques and tools.

## Table of Contents

- [Debugging Tools](#debugging-tools)
- [Application Issues](#application-issues)
- [Database Issues](#database-issues)
- [Queue/Worker Issues](#queueworker-issues)
- [Authentication Issues](#authentication-issues)
- [Deployment Issues](#deployment-issues)
- [Storage Issues](#storage-issues)
- [Nostr Integration Issues](#nostr-integration-issues)
- [Log Analysis](#log-analysis)
- [Common Debugging Scenarios](#common-debugging-scenarios)

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

## Application Issues

### Application Won't Start

**Symptoms:**

- Server fails to start
- Port already in use error
- Module not found errors

**Solutions:**

1. **Check Port Availability:**

   ```bash
   # Check if port 3000 is in use
   lsof -i :3000

   # Kill process if needed
   kill -9 <PID>

   # Or use a different port
   PORT=3001 pnpm start
   ```

2. **Check Environment Variables:**

   ```bash
   # Verify all required variables are set
   cat .env

   # Check for missing variables
   node -e "console.log(process.env.DATABASE_URL)"
   ```

3. **Reinstall Dependencies:**

   ```bash
   rm -rf node_modules pnpm-lock.yaml
   pnpm install
   ```

4. **Check Node.js Version:**
   ```bash
   node --version
   # Should be 20.0.0 or higher
   ```

### Application Crashes

**Symptoms:**

- Application stops responding
- Process exits unexpectedly
- Memory errors

**Solutions:**

1. **Check Logs:**

   ```bash
   pm2 logs
   # or
   docker logs smartflow-app
   ```

2. **Check Memory:**

   ```bash
   # Monitor memory usage
   pm2 monit

   # Increase Node.js memory limit
   NODE_OPTIONS="--max-old-space-size=4096" pnpm start
   ```

3. **Check for Memory Leaks:**
   ```bash
   # Use Node.js inspector
   node --inspect server.ts
   ```

### Health Check Failing

**Symptoms:**

- `/healthcheck` returns 500
- Monitoring alerts triggered

**Solutions:**

1. **Check Database Connection:**

   ```bash
   # Test database connection
   pnpm exec prisma db execute --stdin <<< "SELECT 1"
   ```

2. **Check Database URL:**

   ```bash
   echo $DATABASE_URL
   # Verify format: postgresql://user:pass@host:port/db
   ```

3. **Check Application Logs:**
   ```bash
   pm2 logs --err
   ```

---

## Database Issues

### Connection Errors

**Symptoms:**

- "Connection refused" errors
- "Timeout" errors
- "Authentication failed" errors

**Solutions:**

1. **Verify Database is Running:**

   ```bash
   # PostgreSQL
   pg_isready -h localhost -p 5432

   # Docker
   docker ps | grep postgres
   ```

2. **Check Connection String:**

   ```bash
   # Verify DATABASE_URL format
   echo $DATABASE_URL
   # Should be: postgresql://user:password@host:port/database
   ```

3. **Test Connection:**

   ```bash
   # Using psql
   psql $DATABASE_URL -c "SELECT 1"

   # Using Prisma
   pnpm exec prisma db execute --stdin <<< "SELECT 1"
   ```

4. **Check Firewall:**
   ```bash
   # Verify port is accessible
   telnet <db-host> 5432
   ```

### Migration Issues

**Symptoms:**

- Migrations fail
- Schema out of sync
- Migration conflicts

**Solutions:**

1. **Check Migration Status:**

   ```bash
   pnpm exec prisma migrate status
   ```

2. **Reset Database (Development Only):**

   ```bash
   pnpm exec prisma migrate reset
   ```

3. **Create New Migration:**

   ```bash
   pnpm exec prisma migrate dev --name migration_name
   ```

4. **Deploy Migrations (Production):**
   ```bash
   pnpm exec prisma migrate deploy
   ```

### Slow Queries

**Symptoms:**

- Slow page loads
- Timeout errors
- High database CPU

**Solutions:**

1. **Identify Slow Queries:**

   ```sql
   -- Enable query logging
   SET log_min_duration_statement = 1000; -- Log queries > 1s

   -- View slow queries
   SELECT query, mean_exec_time, calls
   FROM pg_stat_statements
   ORDER BY mean_exec_time DESC
   LIMIT 10;
   ```

2. **Add Indexes:**

   ```sql
   -- Example: Add index on frequently queried column
   CREATE INDEX idx_posts_user_id ON posts(user_id);
   ```

3. **Optimize Queries:**
   - Use `select` to limit fields
   - Add `where` clauses
   - Use pagination

---

## Queue/Worker Issues

### Jobs Not Processing

**Symptoms:**

- Jobs stuck in queue
- No worker activity
- Scheduled posts not publishing

**Solutions:**

1. **Check Worker Status:**

   ```bash
   pm2 list
   # Verify worker is running

   # Check worker logs
   pm2 logs smartflow-worker
   ```

2. **Check Redis Connection:**

   ```bash
   # Test Redis connection
   redis-cli -u $REDIS_URL ping
   # Should return: PONG
   ```

3. **Check Queue Status:**

   ```bash
   redis-cli -u $REDIS_URL
   > KEYS bull:*
   > LLEN bull:scheduled-posts:waiting
   ```

4. **Restart Worker:**
   ```bash
   pm2 restart smartflow-worker
   ```

See [Queue System Documentation](./queue-system.md) for more details.

### Jobs Failing

**Symptoms:**

- Jobs in "failed" state
- Error logs in worker

**Solutions:**

1. **Check Worker Logs:**

   ```bash
   pm2 logs smartflow-worker --err
   ```

2. **Check External Services:**
   - Verify Nostr Publisher is accessible
   - Check database connection
   - Verify user data exists

3. **Retry Failed Jobs:**
   ```typescript
   // In application code or Redis CLI
   const failedJobs = await queue.getFailed();
   for (const job of failedJobs) {
     await job.retry();
   }
   ```

---

## Authentication Issues

### Login Not Working

**Symptoms:**

- Login button does nothing
- Redirects to login page
- Session not persisting

**Solutions:**

1. **Check Nostr Extension:**
   - Verify Nostr extension is installed
   - Check extension permissions
   - Try different extension (Alby, nos2x)

2. **Check Session Configuration:**

   ```typescript
   // Verify SESSION_SECRET is set
   console.log(process.env.SESSION_SECRET);
   ```

3. **Check Cookies:**
   - Verify cookies are enabled
   - Check browser console for errors
   - Clear cookies and try again

4. **Check CORS:**
   - Verify CORS settings if using different domain
   - Check browser console for CORS errors

### Session Expiring Too Quickly

**Symptoms:**

- Users logged out frequently
- Session expires unexpectedly

**Solutions:**

1. **Check Session Configuration:**

   ```typescript
   // Verify maxAge is set correctly
   maxAge: 60 * 60 * 24 * 7, // 7 days
   ```

2. **Check Session Secret:**
   - Verify SESSION_SECRET is consistent across restarts
   - Don't change SESSION_SECRET without warning users

---

## Performance Issues

### Slow Page Loads

**Symptoms:**

- Pages take long to load
- Timeout errors
- High server CPU

**Solutions:**

1. **Check Database Queries:**

   ```sql
   -- Find slow queries
   SELECT query, mean_exec_time
   FROM pg_stat_statements
   ORDER BY mean_exec_time DESC
   LIMIT 10;
   ```

2. **Check N+1 Queries:**

   ```typescript
   // ❌ Bad: N+1 queries
   for (const post of posts) {
     const user = await getUserById(post.userId);
   }

   // ✅ Good: Batch queries
   const userIds = posts.map((p) => p.userId);
   const users = await getUsersByIds(userIds);
   ```

3. **Add Caching:**

   ```typescript
   // Cache frequently accessed data
   const cached = await cache.get(key);
   if (cached) return cached;
   ```

4. **Optimize Images:**
   - Use image optimization
   - Lazy load images
   - Use appropriate image formats

### High Memory Usage

**Symptoms:**

- Application crashes
- Out of memory errors
- Slow performance

**Solutions:**

1. **Monitor Memory:**

   ```bash
   pm2 monit
   # or
   docker stats
   ```

2. **Increase Memory Limit:**

   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" pnpm start
   ```

3. **Check for Memory Leaks:**

   ```bash
   node --inspect server.ts
   # Use Chrome DevTools to analyze
   ```

4. **Optimize Code:**
   - Remove unnecessary data loading
   - Use pagination
   - Clear caches regularly

---

## Deployment Issues

### Build Failures

**Symptoms:**

- Build errors
- TypeScript errors
- Missing dependencies

**Solutions:**

1. **Check Build Logs:**

   ```bash
   pnpm run build
   # Review error messages
   ```

2. **Check TypeScript:**

   ```bash
   pnpm exec tsc --noEmit
   ```

3. **Check Dependencies:**
   ```bash
   pnpm install
   pnpm run build
   ```

### Deployment Errors

**Symptoms:**

- Deployment fails
- Application not accessible
- Environment variables missing

**Solutions:**

1. **Check Environment Variables:**

   ```bash
   # Verify all required variables are set
   fly secrets list
   # or
   railway variables
   ```

2. **Check Logs:**

   ```bash
   fly logs
   # or
   railway logs
   ```

3. **Verify Health Check:**
   ```bash
   curl https://your-domain.com/healthcheck
   ```

---

## Storage Issues

### Image Upload Failing

**Symptoms:**

- Upload errors
- Images not saving
- 403/500 errors

**Solutions:**

1. **Check Storage Configuration:**

   ```bash
   echo $STORAGE_ACCESS_KEY
   echo $STORAGE_SECRET
   echo $STORAGE_BUCKET
   ```

2. **Test Storage Connection:**

   ```typescript
   // Test S3 connection
   import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";

   const client = new S3Client({
     /* config */
   });
   const result = await client.send(new ListBucketsCommand({}));
   ```

3. **Check Bucket Permissions:**
   - Verify bucket exists
   - Check IAM permissions
   - Verify CORS configuration

4. **Check File Size Limits:**
   - Verify file size is within limits
   - Check nginx/load balancer limits

---

## Nostr Integration Issues

### Posts Not Publishing

**Symptoms:**

- Posts scheduled but not published
- Nostr Publisher errors
- Event not appearing on relays

**Solutions:**

1. **Check Nostr Publisher:**

   ```bash
   # Test publisher endpoint
   curl -X POST $NOSTR_PUBLISHER_URL/health
   ```

2. **Check User Relays:**

   ```typescript
   // Verify user has relays configured
   const user = await getUserById(userId);
   console.log(user.userRelays);
   ```

3. **Check Signed Events:**

   ```typescript
   // Verify event is properly signed
   console.log(post.signedEvent);
   ```

4. **Check Worker Logs:**
   ```bash
   pm2 logs smartflow-worker
   # Look for Nostr publishing errors
   ```

### Relay Connection Issues

**Symptoms:**

- Can't fetch profiles
- Events not loading
- WebSocket errors

**Solutions:**

1. **Check Primal Cache URL:**

   ```bash
   echo $PRIMAL_CACHING_URL
   # Verify WebSocket URL format: wss://...
   ```

2. **Test Relay Connection:**
   ```typescript
   // Test WebSocket connection
   const ws = new WebSocket(process.env.PRIMAL_CACHING_URL!);
   ws.on("open", () => console.log("Connected"));
   ws.on("error", (err) => console.error("Error:", err));
   ```

---

## General Debugging

### Enable Debug Logging

```bash
# Set debug environment variable
DEBUG=* pnpm start

# Or specific module
DEBUG=prisma:* pnpm start
```

### Check Application State

```bash
# PM2
pm2 describe smartflow

# Docker
docker inspect smartflow-app

# Process info
ps aux | grep node
```

### Network Debugging

```bash
# Check if port is listening
netstat -tuln | grep 3000

# Test connectivity
curl http://localhost:3000/healthcheck

# Check DNS
nslookup your-domain.com
```

### Database Debugging

```bash
# Prisma Studio
pnpm exec prisma studio

# Direct database access
psql $DATABASE_URL

# Check connections
SELECT count(*) FROM pg_stat_activity;
```

---

## Getting Help

If you're still experiencing issues:

1. **Check Logs**: Review application and worker logs
2. **Check Documentation**: Review relevant documentation
3. **Search Issues**: Check GitHub issues for similar problems
4. **Create Issue**: Open a new issue with:
   - Error messages
   - Steps to reproduce
   - Environment details
   - Relevant logs

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

2. **Check queue status:**

```bash
redis-cli -u $REDIS_URL
KEYS bull:*
# Check if job exists in queue
```

3. **Verify post in database:**

```bash
pnpm exec prisma studio
# Check post status, scheduled time
```

4. **Check Nostr Publisher:**

```bash
# Test publisher endpoint
curl $NOSTR_PUBLISHER_URL/health
```

### Authentication Issues

**Symptoms:**

- Login fails
- Session expires immediately
- Extension not detected

**Debugging steps:**

1. **Check SESSION_SECRET:**

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

## Additional Resources

- [Common Issues](./common-issues.md) - Frequently asked questions and solutions
- [Performance Troubleshooting](./performance.md) - Detailed performance issues
- [Deployment Guide](../guides/deployment.md)
- [Posting Guide](../guides/user-guides/posting.md#queue-types) - Queue system documentation
- [Operations Guide](../guides/operations.md)
