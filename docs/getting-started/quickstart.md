# Quick Start Guide

**Estimated time:** 5 minutes  
**Difficulty:** Beginner  
**Last updated:** 2026-01-02

Get SmartFlowSocial up and running in 5 minutes.

---

## Prerequisites

Before you begin, ensure you have:

- ✅ **Node.js 20.0.0+** installed ([Download](https://nodejs.org/))
- ✅ **pnpm** installed (`npm install -g pnpm`)
- ✅ **PostgreSQL** running (local or remote)
- ✅ **Redis** running (for background jobs)
- ✅ **Nostr browser extension** (Alby, nos2x, or Amber)

---

## Step 1: Clone and Install

```bash
# Clone the repository
git clone https://github.com/xdzczk/SmartFlowSocial.git
cd SmartFlowSocial

# Install dependencies
pnpm install
```

---

## Step 2: Configure Environment

```bash
# Copy the example environment file
cp example.env .env

# Edit .env with your configuration
# At minimum, set:
# - DATABASE_URL
# - SESSION_SECRET
# - NOSTR_PUBLISHER_URL
# - REDIS_URL
# - Storage credentials (S3, R2, etc.)
```

**Quick setup with Docker:**

```bash
# Start PostgreSQL and Redis
pnpm docker

# Use these defaults:
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/smartflow
# REDIS_URL=redis://localhost:6379
```

See [Environment Setup](./installation.md#environment-configuration) for detailed configuration.

---

## Step 3: Set Up Database

```bash
# Generate Prisma client
pnpm exec prisma generate

# Push schema to database
pnpm exec prisma db push

# Seed initial data (optional)
pnpm db:seed
```

---

## Step 4: Start the Application

```bash
# Start development server
pnpm dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

**For production-like setup:**

```bash
# Terminal 1: Main server
pnpm dev

# Terminal 2: Worker process (for scheduled posts)
pnpm start:worker
```

---

## Step 5: Log In

1. Open [http://localhost:3000](http://localhost:3000)
2. Click **"Log in with Nostr"**
3. Approve the login request in your Nostr extension
4. You're in! 🎉

---

## What's Next?

### For End Users

- **[First Steps Guide](./first-steps.md)** - Learn the basics (30 minutes)
- **[Posting Guide](../guides/user-guides/posting.md)** - Create your first post
- **[Calendar Guide](../guides/user-guides/calendar.md)** - Schedule posts visually

### For Developers

- **[Installation Guide](./installation.md)** - Complete development setup
- **[Architecture Overview](./architecture.md)** - Understand the system
- **[Developer Guide](../guides/developer-guide.md)** - Development workflow

### For DevOps

- **[Deployment Guide](../guides/deployment.md)** - Production deployment
- **[Operations Guide](../guides/operations.md)** - Monitoring and maintenance

---

## Troubleshooting

### Database Connection Error

```bash
# Check PostgreSQL is running
pg_isready -h localhost

# Or with Docker
docker ps | grep postgres
```

### Redis Connection Error

```bash
# Check Redis is running
redis-cli ping

# Or with Docker
docker ps | grep redis
```

### Port Already in Use

```bash
# Change port in .env
PORT=3001
```

See [Troubleshooting Guide](../troubleshooting/common-issues.md) for more solutions.

---

## Quick Reference

| Task             | Command                  |
| ---------------- | ------------------------ |
| Start dev server | `pnpm dev`               |
| Start worker     | `pnpm start:worker`      |
| Run tests        | `pnpm test`              |
| Check types      | `pnpm exec tsc --noEmit` |
| Format code      | `pnpm format`            |
| Lint code        | `pnpm lint`              |

---

## Related Documentation

- [Installation Guide](./installation.md) - Detailed setup instructions
- [Environment Configuration](../reference/configuration.md) - All environment variables
- [Architecture Overview](./architecture.md) - System design
- [Troubleshooting](../troubleshooting/common-issues.md) - Common issues and solutions

---

**Next:** [First Steps Guide](./first-steps.md) → Learn the basics in 30 minutes

