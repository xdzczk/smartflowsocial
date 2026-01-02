# Common Issues

**Last updated:** 2025-01-15

Solutions to frequently encountered problems when using SmartFlowSocial.

---

## Table of Contents

- [Installation Issues](#installation-issues)
- [Database Issues](#database-issues)
- [Redis Issues](#redis-issues)
- [Storage Issues](#storage-issues)
- [Posting Issues](#posting-issues)
- [Authentication Issues](#authentication-issues)
- [Performance Issues](#performance-issues)

---

## Installation Issues

### Node.js Version Mismatch

**Problem:** Application fails to start with version error.

**Solution:**
```bash
# Check Node.js version
node --version  # Should be 20.0.0+

# Update Node.js (using nvm)
nvm install 20
nvm use 20

# Or download from nodejs.org
```

---

### Dependencies Installation Fails

**Problem:** `pnpm install` fails with errors.

**Solution:**
```bash
# Clear cache and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install

# If using npm instead
npm install
```

---

### Prisma Client Not Generated

**Problem:** `Cannot find module '@prisma/client'` error.

**Solution:**
```bash
# Generate Prisma client
pnpm exec prisma generate

# Verify client exists
ls node_modules/.prisma/client
```

---

## Database Issues

### Database Connection Failed

**Problem:** `Can't reach database server` error.

**Solutions:**

1. **Verify PostgreSQL is running:**
```bash
# macOS/Linux
pg_isready -h localhost

# Docker
docker ps | grep postgres
```

2. **Check DATABASE_URL format:**
```env
# Correct format
DATABASE_URL=postgresql://user:password@host:port/database?schema=public

# Common mistakes:
# - Missing schema parameter
# - Wrong port
# - Incorrect credentials
```

3. **Test connection manually:**
```bash
psql $DATABASE_URL -c "SELECT 1"
```

4. **Check firewall/network:**
- Ensure PostgreSQL port (5432) is accessible
- Check firewall rules
- Verify network connectivity

---

### Migration Errors

**Problem:** Database migrations fail.

**Solutions:**

1. **Reset database (development only):**
```bash
pnpm exec prisma migrate reset
```

2. **Check migration status:**
```bash
pnpm exec prisma migrate status
```

3. **Apply pending migrations:**
```bash
pnpm exec prisma migrate deploy
```

4. **Manual migration:**
```bash
# Generate migration
pnpm exec prisma migrate dev --name fix-migration

# Review generated SQL
# Apply if correct
```

---

### Database Locked

**Problem:** `database is locked` error.

**Solutions:**

1. **Check for active connections:**
```sql
SELECT * FROM pg_stat_activity WHERE datname = 'smartflow';
```

2. **Kill blocking connections:**
```sql
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'smartflow' AND pid <> pg_backend_pid();
```

3. **Restart PostgreSQL:**
```bash
# macOS
brew services restart postgresql@14

# Linux
sudo systemctl restart postgresql

# Docker
docker restart postgres
```

---

## Redis Issues

### Redis Connection Failed

**Problem:** `ECONNREFUSED` or connection timeout.

**Solutions:**

1. **Verify Redis is running:**
```bash
# Local Redis
redis-cli ping  # Should return PONG

# Docker
docker ps | grep redis
```

2. **Check REDIS_URL format:**
```env
# Correct formats
REDIS_URL=redis://localhost:6379
REDIS_URL=redis://:password@host:6379
REDIS_URL=rediss://default:password@host:6379  # SSL
```

3. **Test connection:**
```bash
redis-cli -u $REDIS_URL ping
```

4. **Check firewall/network:**
- Ensure Redis port (6379) is accessible
- Verify credentials if using password
- Check network connectivity

---

### Queue Jobs Not Processing

**Problem:** Scheduled posts not publishing.

**Solutions:**

1. **Verify worker process is running:**
```bash
# Check if worker is running
ps aux | grep "start:worker"

# Start worker if not running
pnpm start:worker
```

2. **Check Redis connection:**
```bash
redis-cli -u $REDIS_URL ping
```

3. **Check queue status:**
```bash
# Connect to Redis
redis-cli -u $REDIS_URL

# Check queue keys
KEYS bull:*

# Check queue length
LLEN bull:post-publish:wait
```

4. **Review worker logs:**
- Check for error messages
- Verify job processing
- Check for stuck jobs

---

## Storage Issues

### Image Upload Failed

**Problem:** Images fail to upload.

**Solutions:**

1. **Verify storage credentials:**
```env
STORAGE_ACCESS_KEY=your-key
STORAGE_SECRET=your-secret
STORAGE_REGION=us-east-1
STORAGE_BUCKET=your-bucket
```

2. **Check bucket exists:**
```bash
# AWS S3
aws s3 ls s3://your-bucket

# Cloudflare R2
# Check in Cloudflare Dashboard
```

3. **Verify IAM permissions (AWS S3):**
- `s3:PutObject`
- `s3:GetObject`
- `s3:DeleteObject`

4. **Check CORS configuration:**
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": []
  }
]
```

5. **Test upload manually:**
```bash
# AWS S3
aws s3 cp test.jpg s3://your-bucket/test.jpg

# Verify file appears in bucket
```

---

### Storage Access Denied

**Problem:** `AccessDenied` error when uploading.

**Solutions:**

1. **Check credentials:**
- Verify access key is correct
- Verify secret key is correct
- Check for typos

2. **Verify bucket permissions:**
- Bucket must allow writes
- IAM user must have write permissions
- Check bucket policy

3. **Check region:**
- Ensure region matches bucket region
- Use `auto` for Cloudflare R2

---

## Posting Issues

### Post Not Publishing

**Problem:** Scheduled post doesn't publish.

**Solutions:**

1. **Check worker process:**
```bash
# Verify worker is running
pnpm start:worker

# Check worker logs for errors
```

2. **Verify post status:**
- Check post is in "Scheduled" status
- Verify scheduled time has passed
- Check post in database

3. **Check Nostr Publisher:**
```bash
# Test publisher endpoint
curl $NOSTR_PUBLISHER_URL/health

# Verify NOSTR_PUBLISHER_URL is correct
```

4. **Check Redis queue:**
```bash
redis-cli -u $REDIS_URL
KEYS bull:*
```

---

### Post Published but Not Visible

**Problem:** Post shows as published but not on Nostr.

**Solutions:**

1. **Check relay connectivity:**
- Verify relays are accessible
- Check network connectivity
- Test with different relays

2. **Verify event signature:**
- Check event was signed correctly
- Verify signature in event data
- Test with Nostr client

3. **Check relay filters:**
- Some relays filter content
- Try different relays
- Check relay policies

---

## Authentication Issues

### Login Fails

**Problem:** Cannot log in with Nostr extension.

**Solutions:**

1. **Verify extension is installed:**
- [Alby](https://getalby.com/)
- [nos2x](https://github.com/fiatjaf/nos2x)
- [Amber](https://amber.app/)

2. **Check extension permissions:**
- Ensure extension has access to site
- Approve extension permissions
- Try different extension

3. **Clear browser cache:**
```bash
# Clear cookies and cache
# Or use incognito/private mode
```

4. **Check session secret:**
```env
SESSION_SECRET=your-secret-here
```

---

### Session Expires Immediately

**Problem:** Logged out immediately after login.

**Solutions:**

1. **Check SESSION_SECRET:**
```env
# Must be set and consistent
SESSION_SECRET=your-random-32-character-secret
```

2. **Verify cookie settings:**
- Check SameSite settings
- Verify secure cookies in production
- Check domain settings

3. **Clear cookies:**
- Clear browser cookies
- Try different browser
- Check browser console for errors

---

## Performance Issues

### Slow Page Loads

**Problem:** Pages load slowly.

**Solutions:**

1. **Check database queries:**
```bash
# Enable query logging
# Review slow queries
# Add database indexes
```

2. **Check Redis connection:**
- Verify Redis is accessible
- Check Redis performance
- Monitor Redis memory

3. **Review application logs:**
- Check for errors
- Review response times
- Identify bottlenecks

4. **Optimize images:**
- Compress images before upload
- Use appropriate image sizes
- Enable CDN if available

---

### High Memory Usage

**Problem:** Application uses too much memory.

**Solutions:**

1. **Check for memory leaks:**
- Review application logs
- Monitor memory over time
- Identify growing objects

2. **Optimize database queries:**
- Use pagination
- Limit result sets
- Add indexes

3. **Review worker processes:**
- Check worker memory usage
- Limit concurrent jobs
- Restart workers periodically

---

## Getting More Help

If you're still experiencing issues:

1. **Check logs:**
   - Application logs
   - Worker logs
   - Database logs
   - Redis logs

2. **Review documentation:**
   - [Installation Guide](../getting-started/installation.md)
   - [Configuration Reference](../reference/configuration.md)
   - [Debugging Guide](./debugging.md)

3. **Open an issue:**
   - [GitHub Issues](https://github.com/xdzczk/SmartFlowSocial/issues)
   - Include error messages
   - Provide environment details
   - Share relevant logs

---

## Related Documentation

- [Installation Guide](../getting-started/installation.md) - Setup instructions
- [Configuration Reference](../reference/configuration.md) - Configuration options
- [Debugging Guide](./debugging.md) - Debugging techniques
- [Performance Troubleshooting](./performance.md) - Performance issues

---

**Next:** [Debugging Guide](./debugging.md) → Learn debugging techniques

