# Common Issues

**Last updated:** 2025-03-12

Solutions to frequently encountered problems when using SmartFlowSocial.

---

## Table of Contents

- [Installation Issues](#installation-issues)
- [Database Issues](#database-issues)
- [Redis Issues](#redis-issues)
- [Storage Issues](#storage-issues)
- [Push notification issues](#push-notification-issues)
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

### Blossom upload failed

**Problem:** Uploads to Blossom (vibe-cdn) fail with quota, token, or policy errors.

**Solutions:**

1. **Check Blossom configuration:**
   - Ensure `BLOSSOM_SFS_API_URL` and `BLOSSOM_INTERNAL_SECRET` (and optionally
     `BLOSSOM_UPLOAD_TOKEN_SECRET`) are set and match the Blossom server.
   - For token-based uploads, the app requests tokens from the Blossom API; ensure the Blossom
     server can reach your app’s internal endpoints if required.

2. **Quota or subscription:**
   - Errors like `quota_exceeded` or `allowCompatUpload: false` mean the user’s plan or subscription
     does not allow more uploads. Check subscription status and plan limits.

3. **Internal endpoint:**
   - If Blossom calls back to your app (e.g. commit-batch), ensure `APP_URL` and any firewall allow
     the Blossom server to reach your app and that `BLOSSOM_INTERNAL_SECRET` matches on both sides.

---

## Push notification issues

### Push subscription fails or notifications not received

**Problem:** Browser push subscription fails, or push notifications never appear after subscribing.

**Solutions:**

1. **VAPID keys:**
   - Set `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` in the environment (generate with
     `npx web-push generate-vapid-keys`). If missing, the subscribe endpoint returns 503.

2. **HTTPS:**
   - Push requires a secure context (HTTPS or localhost). Ensure the app is served over HTTPS in
     production.

3. **Browser permissions:**
   - User must allow notifications when prompted. If they block or dismiss, resubscribe from
     Settings or the prompt when the app requests permission again.

4. **Endpoint validity:**
   - Subscriptions can expire or be invalidated. If notifications stop, the user may need to
     unsubscribe and subscribe again (e.g. from Settings).

5. **Worker or server:**
   - Notifications are sent from the server when events occur (e.g. publish success). Ensure the app
     and any worker processes are running and can send Web Push payloads.

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

---

## Frequently Asked Questions

### General

**What is SmartFlowSocial?**

SmartFlowSocial is a professional-grade social media management platform for the Nostr protocol.
Available as a hosted service or self-hostable open source software.

**Is SmartFlowSocial free?**

Yes! SmartFlowSocial is open-source (Unlicense, public domain) and free to use. Self-hosting is
completely free forever. The hosted version offers a free plan with basic features, and paid plans
for advanced features.

**Is there a hosted version?**

Yes! We offer a hosted instance at [smartflow.social](https://smartflow.social) and
[smartflowsocial.com](https://smartflowsocial.com). You can also self-host for full control over
your data and infrastructure.

**How do I sign up for the hosted version?**

Visit [smartflow.social](https://smartflow.social) and sign up with your Nostr extension. No credit
card required for the free plan.

### Setup & Installation

**What are the system requirements?**

- **Node.js** 20.0.0 or higher
- **PostgreSQL** 14+ (local or managed)
- **Redis** 6+ (for background jobs)
- **S3-compatible storage** (for image uploads)
- **HTTP Nostr Publisher** service

**Do I need to host it myself?**

No! You can use our [hosted instance](https://smartflow.social) with no setup required.
Alternatively, you can self-host for full control over your data and infrastructure.

**How long does setup take?**

- **Quick Start:** 5 minutes (with Docker)
- **Full Installation:** 15-30 minutes
- **Production Deployment:** 1-2 hours

See [Quick Start Guide](../getting-started/quickstart.md) for details.

### Authentication & Security

**Is my data private?**

Absolutely. Your private keys never leave your browser. All events are signed client-side using
NIP-07. We never see or store your private keys.

**What Nostr extensions are supported?**

Any NIP-07 compatible extension works:

- [Alby](https://getalby.com/) (recommended)
- [nos2x](https://github.com/fiatjaf/nos2x)
- [Amber](https://amber.app/)
- And others

**How does authentication work?**

1. You log in with your Nostr extension
2. Extension signs a challenge
3. Server creates a session cookie
4. Cookie contains your public key (npub)
5. Server validates session on each request

### Posting & Scheduling

**How does scheduling work?**

Posts are signed with future timestamps and stored in a queue. A background worker process checks
the queue and publishes posts to Nostr relays at the specified time.

**Can I edit a scheduled post?**

Yes! Go to **Scheduled**, click on a post, and edit it. Changes are saved and will be published at
the scheduled time.

**What happens if I delete a scheduled post?**

The post is removed from the queue and won't be published. This action cannot be undone.

**Can I use it with multiple Nostr accounts?**

Yes! SmartFlowSocial supports parent/child account relationships, allowing you to manage multiple
accounts from one interface.

### Queues

**What is a queue?**

A queue controls how posts are scheduled:

- **Interval Queue** - Post every X hours automatically
- **Fixed Time Slots** - Post at specific times daily
- **Manual** - Schedule posts individually

**How do I create a queue?**

1. Go to **Settings** → **Queues**
2. Click **"Create Queue"**
3. Choose queue type
4. Configure settings
5. Save

**Can I override queue scheduling?**

Yes! When scheduling a post, you can override the queue and choose a specific time manually.

### Storage

**What storage providers are supported?**

Any S3-compatible storage:

- **AWS S3**
- **Cloudflare R2**
- **MinIO** (self-hosted)
- **DigitalOcean Spaces**
- **Backblaze B2**

**Do I need storage?**

Yes, storage is required for image uploads. You can use any S3-compatible provider.

**How do I set up storage?**

See [Installation Guide](../getting-started/installation.md#storage-setup) for detailed
instructions.

### Development

**How do I contribute?**

See [Contributing Guide](../../CONTRIBUTING.md) for:

- Development setup
- Coding standards
- Pull request process
- Code of conduct

**How do I report bugs?**

Open an issue on [GitHub](https://github.com/xdzczk/SmartFlowSocial/issues):

- Include clear steps to reproduce
- Specify your environment
- Add screenshots if applicable

**How do I request a feature?**

Open a feature request on
[GitHub Discussions](https://github.com/xdzczk/SmartFlowSocial/discussions):

- Describe the feature
- Explain the use case
- Suggest implementation if possible

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
   - [Error Troubleshooting](./errors.md) - Detailed error resolution
   - [Performance Troubleshooting](./performance.md) - Performance issues

3. **Open an issue:**
   - [GitHub Issues](https://github.com/xdzczk/SmartFlowSocial/issues)
   - Include error messages
   - Provide environment details
   - Share relevant logs

---

## Related Documentation

- [Installation Guide](../getting-started/installation.md) - Setup instructions
- [Configuration Reference](../reference/configuration.md) - Configuration options
- [Error Troubleshooting](./errors.md) - Detailed error resolution and debugging
- [Performance Troubleshooting](./performance.md) - Performance issues

---

**Next:** [Error Troubleshooting](./errors.md) → Detailed error resolution
