# Common Tasks Quick Reference

**Last updated:** 2026-01-02

Quick reference for common SmartFlowSocial tasks.

---

## User Tasks

### Create a Post

1. Click **"New Post"**
2. Enter content
3. Add images (optional)
4. Click **"Post Now"** or **"Schedule"**

### Schedule a Post

1. Create post
2. Click **"Schedule"**
3. Select date and time
4. Choose queue (optional)
5. Click **"Schedule Post"**

### View Scheduled Posts

1. Click **"Scheduled"** in navigation
2. View all scheduled posts
3. Edit or delete as needed

### Use Calendar View

1. Click **"Calendar"** in navigation
2. View posts on calendar
3. Drag and drop to reschedule
4. Switch between Week/Month views

### Create a Queue

1. Go to **Settings** → **Queues**
2. Click **"Create Queue"**
3. Choose type (Interval or Fixed Slots)
4. Configure settings
5. Save

### Upload Images

1. Click **"New Post"**
2. Click **"Add Image"**
3. Select file(s)
4. Wait for upload
5. Post or schedule

---

## Developer Tasks

### Set Up Development Environment

```bash
git clone https://github.com/xdzczk/SmartFlowSocial.git
cd SmartFlowSocial
pnpm install
cp example.env .env
# Edit .env
pnpm exec prisma generate
pnpm exec prisma db push
pnpm dev
```

### Run Tests

```bash
# All tests
pnpm test

# Unit tests
pnpm test:unit

# Integration tests
pnpm test:integration

# E2E tests
pnpm test:e2e

# With coverage
pnpm test:coverage
```

### Create Database Migration

```bash
# Make changes to schema.prisma
pnpm exec prisma migrate dev --name migration-name

# Review generated migration
# Test migration
```

### Start Worker Process

```bash
# Development
pnpm start:worker

# Production
# Run as separate process or service
```

---

## Operations Tasks

### Deploy to Production

1. Set up production environment
2. Configure environment variables
3. Run database migrations
4. Deploy application
5. Start worker process

See [Deployment Guide](../guides/deployment.md) for details.

### Monitor Application

1. Check application logs
2. Monitor worker logs
3. Review database performance
4. Check Redis queue status

See [Operations Guide](../guides/operations.md) for details.

### Backup Database

```bash
# PostgreSQL backup
pg_dump $DATABASE_URL > backup.sql

# Restore
psql $DATABASE_URL < backup.sql
```

### Update Application

```bash
git pull origin main
pnpm install
pnpm exec prisma migrate deploy
pnpm build
# Restart application
```

---

## Configuration Tasks

### Generate Session Secret

```bash
openssl rand -base64 32
```

### Test Database Connection

```bash
psql $DATABASE_URL -c "SELECT 1"
```

### Test Redis Connection

```bash
redis-cli -u $REDIS_URL ping
```

### Verify Environment Variables

```bash
# Check all required variables are set
node -e "
const required = ['DATABASE_URL', 'SESSION_SECRET', 'NOSTR_PUBLISHER_URL', 'REDIS_URL'];
const missing = required.filter(key => !process.env[key]);
if (missing.length > 0) {
  console.error('Missing:', missing);
  process.exit(1);
}
console.log('All required variables set');
"
```

---

## Troubleshooting Tasks

### Check Application Status

```bash
# Check if running
curl http://localhost:3000/healthcheck

# Check logs
tail -f /var/log/app.log
```

### Check Worker Status

```bash
# Check if running
ps aux | grep "start:worker"

# Check queue
redis-cli -u $REDIS_URL KEYS bull:*
```

### Reset Database (Development)

```bash
pnpm exec prisma migrate reset
pnpm db:seed
```

### Clear Redis Queue

```bash
redis-cli -u $REDIS_URL FLUSHDB
```

---

## Related Documentation

- [Quick Start Guide](../getting-started/quickstart.md) - 5-minute setup
- [Installation Guide](../getting-started/installation.md) - Complete setup
- [Common Issues](../troubleshooting/common-issues.md) - Problem solving
- [Developer Guide](../guides/developer-guide.md) - Development workflow

---

**Next:** [Glossary](./glossary.md) → Terminology reference
