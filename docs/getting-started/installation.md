# Installation Guide

**Estimated time:** 15 minutes  
**Difficulty:** Beginner  
**Last updated:** 2026-01-02

Complete installation guide for SmartFlowSocial, covering all platforms and deployment options.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation Methods](#installation-methods)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Storage Setup](#storage-setup)
- [External Services](#external-services)
- [Verification](#verification)
- [Next Steps](#next-steps)

---

## Prerequisites

### Required

- **Node.js** 20.0.0 or higher ([Download](https://nodejs.org/))
- **pnpm** package manager (`npm install -g pnpm`)
- **PostgreSQL** 14+ (local or managed)
- **Redis** 6+ (for BullMQ queues)

### Optional

- **Docker** and **Docker Compose** (for local development)
- **Nostr browser extension** (Alby, nos2x, or Amber)
- **Lightning wallet** (for payments)

### Verify Prerequisites

```bash
# Check Node.js version
node --version  # Should be 20.0.0 or higher

# Check pnpm
pnpm --version

# Check PostgreSQL (if local)
psql --version

# Check Redis (if local)
redis-cli --version

# Check Docker (optional)
docker --version
```

---

## Installation Methods

### Method 1: Local Installation (Recommended for Development)

```bash
# 1. Clone repository
git clone https://github.com/xdzczk/SmartFlowSocial.git
cd SmartFlowSocial

# 2. Install dependencies
pnpm install

# 3. Configure environment (see below)
cp example.env .env
# Edit .env with your settings

# 4. Set up database
pnpm exec prisma generate
pnpm exec prisma db push

# 5. Start services
pnpm docker  # Starts PostgreSQL and Redis

# 6. Start application
pnpm dev
```

### Method 2: Docker Compose (Quick Start)

```bash
# 1. Clone repository
git clone https://github.com/xdzczk/SmartFlowSocial.git
cd SmartFlowSocial

# 2. Configure environment
cp example.env .env
# Edit .env

# 3. Start all services
docker-compose up -d

# 4. Run migrations
docker-compose exec app pnpm exec prisma migrate deploy

# 5. Access application
# http://localhost:3000
```

### Method 3: Production Deployment

See [Deployment Guide](../guides/deployment.md) for production deployment on:

- Fly.io
- Railway
- AWS/EC2
- Docker
- VPS

---

## Environment Configuration

### Required Variables

Create a `.env` file from `example.env`:

```bash
cp example.env .env
```

**Minimum required variables:**

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/smartflow

# Session
SESSION_SECRET=your-random-32-character-secret-here

# Nostr Publisher
NOSTR_PUBLISHER_URL=https://your-publisher.example.com

# Redis
REDIS_URL=redis://localhost:6379

# Storage (S3-compatible)
STORAGE_ACCESS_KEY=your-access-key
STORAGE_SECRET=your-secret-key
STORAGE_REGION=us-east-1
STORAGE_BUCKET=your-bucket-name
```

### Generate Session Secret

```bash
# Generate a secure random secret
openssl rand -base64 32
```

### Complete Configuration

See [Configuration Reference](../reference/configuration.md) for all available options.

---

## Database Setup

### Option 1: Local PostgreSQL

```bash
# Install PostgreSQL (macOS)
brew install postgresql@14
brew services start postgresql@14

# Create database
createdb smartflow

# Update DATABASE_URL in .env
DATABASE_URL=postgresql://$(whoami)@localhost:5432/smartflow
```

### Option 2: Docker PostgreSQL

```bash
# Start PostgreSQL container
pnpm docker

# Or manually
docker run -d \
  --name postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=smartflow \
  -p 5432:5432 \
  postgres:14

# Use this DATABASE_URL
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/smartflow
```

### Option 3: Managed PostgreSQL

Use a managed service:

- **Supabase** (free tier available)
- **Railway** (PostgreSQL addon)
- **Render** (PostgreSQL service)
- **AWS RDS**
- **Google Cloud SQL**

### Initialize Database

```bash
# Generate Prisma client
pnpm exec prisma generate

# Push schema to database
pnpm exec prisma db push

# Or use migrations (production)
pnpm exec prisma migrate deploy

# Seed database (optional)
pnpm db:seed
```

---

## Storage Setup

SmartFlowSocial requires S3-compatible storage for image uploads.

### Option 1: AWS S3

```env
STORAGE_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE
STORAGE_SECRET=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
STORAGE_REGION=us-east-1
STORAGE_BUCKET=my-smartflow-bucket
```

1. Create S3 bucket in AWS Console
2. Create IAM user with S3 access
3. Generate access keys
4. Configure CORS if needed

### Option 2: Cloudflare R2

```env
STORAGE_ACCESS_KEY=your-r2-access-key
STORAGE_SECRET=your-r2-secret-key
STORAGE_REGION=auto
STORAGE_BUCKET=your-bucket-name
```

1. Create R2 bucket in Cloudflare Dashboard
2. Create API token
3. Use `auto` for region

### Option 3: MinIO (Self-Hosted)

```bash
# Start MinIO with Docker
docker run -d \
  --name minio \
  -p 9000:9000 \
  -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  minio/minio server /data --console-address ":9001"
```

```env
STORAGE_ACCESS_KEY=minioadmin
STORAGE_SECRET=minioadmin
STORAGE_REGION=us-east-1
STORAGE_BUCKET=smartflow
```

Access MinIO console at http://localhost:9001

---

## External Services

### HTTP Nostr Publisher

Required for publishing posts to Nostr relays.

**Deploy your own:**

- [HTTP Nostr Publisher](https://github.com/getAlby/http-nostr-publisher)

**Or use a hosted service:**

- Configure `NOSTR_PUBLISHER_URL` in `.env`

### Primal Caching Service (Optional)

For profile and event lookups.

**Default (public endpoints):**

- Uses public Primal cache if not configured

**Self-hosted:**

- [Primal Caching Service](https://github.com/PrimalHQ/primal-caching-service)
- Configure `PRIMAL_CACHING_URL` in `.env`

### Redis Setup

**Local Redis:**

```bash
# macOS
brew install redis
brew services start redis

# Linux
sudo apt-get install redis-server
sudo systemctl start redis
```

**Docker Redis:**

```bash
docker run -d \
  --name redis \
  -p 6379:6379 \
  redis:7-alpine
```

**Managed Redis:**

- **Upstash** (serverless Redis)
- **Redis Cloud**
- **AWS ElastiCache**

---

## Verification

### Check Installation

```bash
# Verify Node.js version
node --version  # Should be 20.0.0+

# Verify dependencies installed
pnpm list --depth=0

# Verify Prisma client generated
ls node_modules/.prisma/client
```

### Test Database Connection

```bash
# Test PostgreSQL connection
psql $DATABASE_URL -c "SELECT version();"

# Or with Prisma
pnpm exec prisma db execute --stdin <<< "SELECT 1"
```

### Test Redis Connection

```bash
# Test Redis connection
redis-cli -u $REDIS_URL ping
# Should return: PONG
```

### Start Application

```bash
# Start development server
pnpm dev

# Check health endpoint
curl http://localhost:3000/healthcheck
```

### Verify Worker Process

```bash
# Start worker in separate terminal
pnpm start:worker

# Check for worker logs
# Should see: "Worker started"
```

---

## Next Steps

### For Development

1. **[First Steps Guide](./first-steps.md)** - Learn the basics
2. **[Architecture Overview](./architecture.md)** - Understand the system
3. **[Developer Guide](../guides/developer-guide.md)** - Development workflow
4. **[Testing Guide](../guides/testing.md)** - Testing strategies

### For Production

1. **[Deployment Guide](../guides/deployment.md)** - Production deployment
2. **[Operations Guide](../guides/operations.md)** - Monitoring and maintenance
3. **[Security Guide](../guides/security.md)** - Security best practices

### For Users

1. **[Posting Guide](../guides/user-guides/posting.md)** - Create posts
2. **[Calendar Guide](../guides/user-guides/calendar.md)** - Schedule posts
3. **[Payments Guide](../guides/user-guides/payments.md)** - Manage subscriptions

---

## Troubleshooting

### Common Issues

**Database connection failed:**

- Verify PostgreSQL is running
- Check `DATABASE_URL` format
- Ensure database exists

**Redis connection failed:**

- Verify Redis is running
- Check `REDIS_URL` format
- Test with `redis-cli ping`

**Storage upload failed:**

- Verify storage credentials
- Check bucket exists and is accessible
- Verify IAM permissions (AWS S3)

See [Troubleshooting Guide](../troubleshooting/common-issues.md) for more solutions.

---

## Related Documentation

- [Quick Start Guide](./quickstart.md) - 5-minute setup
- [Configuration Reference](../reference/configuration.md) - All configuration options
- [Architecture Overview](./architecture.md) - System design
- [Deployment Guide](../guides/deployment.md) - Production deployment

---

**Next:** [First Steps Guide](./first-steps.md) → Learn the basics





