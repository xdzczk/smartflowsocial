# Deployment Guide

**Estimated time:** 45 minutes  
**Difficulty:** Intermediate  
**Last updated:** 2026-01-02

Complete guide for deploying SmartFlowSocial to production environments, including platform-specific instructions and best practices.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Pre-Deployment Checklist](#pre-deployment-checklist)
- [Platform-Specific Guides](#platform-specific-guides)
- [Docker Deployment](#docker-deployment)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Worker Process Setup](#worker-process-setup)
- [SSL/TLS Configuration](#ssltls-configuration)
- [Reverse Proxy Setup](#reverse-proxy-setup)
- [Process Management](#process-management)
- [Health Checks](#health-checks)
- [Post-Deployment Verification](#post-deployment-verification)
- [Scaling](#scaling)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying, ensure you have:

- ✅ Node.js 20.0.0 or higher
- ✅ PostgreSQL database (managed or self-hosted)
- ✅ Redis instance (for BullMQ queues)
- ✅ S3-compatible storage (for image uploads)
- ✅ HTTP Nostr Publisher service
- ✅ Domain name (for production)
- ✅ SSL certificate (or use Let's Encrypt)

---

## Pre-Deployment Checklist

- [ ] All environment variables configured
- [ ] Database migrations tested
- [ ] Production database backed up
- [ ] Redis configured and accessible
- [ ] Storage bucket created and configured
- [ ] Nostr Publisher service deployed
- [ ] Domain DNS configured
- [ ] SSL certificate obtained
- [ ] Worker process configured
- [ ] Monitoring and logging setup
- [ ] Error tracking configured
- [ ] Backup strategy in place

---

## Platform-Specific Guides

### Fly.io

Fly.io is well-suited for Remix applications with built-in PostgreSQL and Redis support.

#### 1. Install Fly CLI

```bash
curl -L https://fly.io/install.sh | sh
```

#### 2. Login to Fly.io

```bash
fly auth login
```

#### 3. Initialize Fly.io App

```bash
fly launch
```

This will create a `fly.toml` configuration file.

#### 4. Configure Secrets

```bash
fly secrets set DATABASE_URL="postgresql://..."
fly secrets set SESSION_SECRET="your-secret"
fly secrets set NOSTR_PUBLISHER_URL="https://..."
fly secrets set NOSTR_NSEC="nsec1..."
fly secrets set PRIMAL_CACHING_URL="wss://..."
fly secrets set REDIS_URL="redis://..."
fly secrets set STORAGE_ACCESS_KEY="..."
fly secrets set STORAGE_SECRET="..."
fly secrets set STORAGE_REGION="..."
fly secrets set STORAGE_BUCKET="..."
fly secrets set OWNER_NWC="nostr+walletconnect://..."
```

#### 5. Create PostgreSQL Database

```bash
fly postgres create --name smartflow-db
fly postgres attach smartflow-db
```

#### 6. Create Redis Instance

```bash
fly redis create
```

#### 7. Deploy Application

```bash
fly deploy
```

#### 8. Deploy Worker Process

Create a separate `fly.worker.toml` for the worker:

```toml
app = "smartflow-worker"
primary_region = "iad"

[build]

[env]
  NODE_ENV = "production"

[[services]]
  internal_port = 3000
  protocol = "tcp"
```

Deploy worker:

```bash
fly deploy --config fly.worker.toml
```

#### 9. Scale Workers

```bash
fly scale count worker=2
```

---

### Railway

Railway provides simple deployment with automatic PostgreSQL and Redis provisioning.

#### 1. Install Railway CLI

```bash
pnpm add -g @railway/cli
```

#### 2. Login

```bash
railway login
```

#### 3. Initialize Project

```bash
railway init
```

#### 4. Add PostgreSQL Service

In Railway dashboard:
- Click "New" → "Database" → "PostgreSQL"
- Railway automatically sets `DATABASE_URL`

#### 5. Add Redis Service

- Click "New" → "Database" → "Redis"
- Railway automatically sets `REDIS_URL`

#### 6. Configure Environment Variables

In Railway dashboard, add all required environment variables.

#### 7. Deploy

```bash
railway up
```

#### 8. Deploy Worker

Create a separate service for the worker:

```bash
railway add
# Select "Empty Service"
# Set start command: pnpm start:worker
```

---

### Vercel

Vercel is optimized for frontend deployments but can run Remix applications.

**Note**: Vercel has limitations for long-running processes. Consider using Vercel for the main app and a separate service for the worker.

#### 1. Install Vercel CLI

```bash
pnpm add -g vercel
```

#### 2. Deploy

```bash
vercel --prod
```

#### 3. Configure Environment Variables

In Vercel dashboard → Settings → Environment Variables

#### 4. Worker Process

Deploy worker separately to Railway, Fly.io, or a VPS.

---

### AWS (EC2/ECS)

#### 1. EC2 Deployment

**Setup:**

```bash
# SSH into EC2 instance
ssh ubuntu@your-ec2-ip

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo pnpm install -g pm2

# Clone repository
git clone https://github.com/xdzczk/SmartFlowSocial.git
cd SmartFlowSocial

# Install dependencies
pnpm install

# Build application
pnpm build

# Start with PM2
pm2 start pnpm --name "smartflow" -- start
pm2 start pnpm --name "smartflow-worker" -- run start:worker

# Save PM2 configuration
pm2 save
pm2 startup
```

#### 2. ECS Deployment

Use Docker images with ECS. See [Docker Deployment](#docker-deployment) section.

---

### Docker Deployment

#### 1. Build Docker Image

```bash
docker build -t smartflow:latest .
```

#### 2. Run with Docker Compose

Create `docker-compose.prod.yml`:

```yaml
version: "3.8"

services:
  app:
    image: smartflow:latest
    restart: always
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - SESSION_SECRET=${SESSION_SECRET}
      - NOSTR_PUBLISHER_URL=${NOSTR_PUBLISHER_URL}
      - NOSTR_NSEC=${NOSTR_NSEC}
      - PRIMAL_CACHING_URL=${PRIMAL_CACHING_URL}
      - REDIS_URL=${REDIS_URL}
      - STORAGE_ACCESS_KEY=${STORAGE_ACCESS_KEY}
      - STORAGE_SECRET=${STORAGE_SECRET}
      - STORAGE_REGION=${STORAGE_REGION}
      - STORAGE_BUCKET=${STORAGE_BUCKET}
      - OWNER_NWC=${OWNER_NWC}
    depends_on:
      - postgres
      - redis
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/healthcheck"]
      interval: 30s
      timeout: 10s
      retries: 3

  worker:
    image: smartflow:latest
    restart: always
    command: pnpm start:worker
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      # ... other env vars
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15
    restart: always
    environment:
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=${POSTGRES_DB}
    volumes:
      - postgres-data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    restart: always
    volumes:
      - redis-data:/data

volumes:
  postgres-data:
  redis-data:
```

#### 3. Deploy

```bash
docker-compose -f docker-compose.prod.yml up -d
```

---

## Environment Configuration

### Production Environment Variables

Create a `.env.production` file (never commit this):

```env
# Application
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://user:password@host:5432/smartflow

# Session
SESSION_SECRET=your-super-secret-session-key-min-32-chars

# Nostr
NOSTR_PUBLISHER_URL=https://your-publisher.example.com
NOSTR_NSEC=nsec1...
PRIMAL_CACHING_URL=wss://cache.example.com/v1

# Redis
REDIS_URL=redis://host:6379

# Storage
STORAGE_ACCESS_KEY=your-access-key
STORAGE_SECRET=your-secret-key
STORAGE_REGION=us-east-1
STORAGE_BUCKET=smartflow-uploads

# Payments
OWNER_NWC=nostr+walletconnect://...

# Metrics (optional)
METRICS_PORT=3010
```

### Security Best Practices

1. **Never commit `.env` files**
2. **Use strong secrets**: Generate with `openssl rand -base64 32`
3. **Rotate secrets regularly**
4. **Use secret management services**: AWS Secrets Manager, HashiCorp Vault, etc.
5. **Restrict access**: Only necessary services should access secrets

---

## Database Setup

### 1. Run Migrations

```bash
# Generate Prisma client
pnpm exec prisma generate

# Run migrations
pnpm exec prisma migrate deploy
```

### 2. Seed Initial Data (Optional)

```bash
pnpm db:seed
```

### 3. Verify Database Connection

```bash
pnpm exec prisma studio
```

### 4. Backup Strategy

Set up automated backups:

```bash
# PostgreSQL backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Restore
psql $DATABASE_URL < backup-20240101.sql
```

For managed databases (AWS RDS, Railway, Fly.io), use their built-in backup features.

---

## Worker Process Setup

The worker process handles scheduled posts and background jobs.

### Standalone Worker

```bash
pnpm start:worker
```

### With PM2

```bash
pm2 start pnpm --name "smartflow-worker" -- run start:worker
pm2 save
```

### With Docker

```bash
docker run -d \
  --name smartflow-worker \
  --env-file .env.production \
  smartflow:latest \
  pnpm start:worker
```

### Scaling Workers

You can run multiple worker instances:

```bash
# PM2
pm2 start pnpm --name "worker-1" -- run start:worker
pm2 start pnpm --name "worker-2" -- run start:worker

# Docker Compose
docker-compose scale worker=3
```

---

## SSL/TLS Configuration

### Let's Encrypt (Recommended)

#### With Caddy

Caddy automatically handles Let's Encrypt certificates:

```caddy
smartflow.example.com {
    reverse_proxy localhost:3000
}
```

#### With Certbot

```bash
# Install Certbot
sudo apt-get install certbot

# Obtain certificate
sudo certbot certonly --standalone -d smartflow.example.com

# Auto-renewal
sudo certbot renew --dry-run
```

### Manual Certificate

If you have your own certificate:

```nginx
ssl_certificate /path/to/cert.pem;
ssl_certificate_key /path/to/key.pem;
```

---

## Reverse Proxy Setup

### Nginx

```nginx
server {
    listen 80;
    server_name smartflow.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name smartflow.example.com;

    ssl_certificate /etc/ssl/certs/smartflow.crt;
    ssl_certificate_key /etc/ssl/private/smartflow.key;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check
    location /healthcheck {
        proxy_pass http://localhost:3000/healthcheck;
        access_log off;
    }
}
```

### Caddy

```caddy
smartflow.example.com {
    reverse_proxy localhost:3000 {
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
```

---

## Process Management

### PM2 (Recommended)

```bash
# Install PM2
pnpm install -g pm2

# Start application
pm2 start pnpm --name "smartflow" -- start

# Start worker
pm2 start pnpm --name "smartflow-worker" -- run start:worker

# Save configuration
pm2 save

# Setup startup script
pm2 startup
pm2 save

# Monitor
pm2 monit

# Logs
pm2 logs
```

### systemd

Create `/etc/systemd/system/smartflow.service`:

```ini
[Unit]
Description=SmartFlowSocial Application
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/smartflow
Environment=NODE_ENV=production
ExecStart=/usr/bin/pnpm start
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable smartflow
sudo systemctl start smartflow
```

---

## Health Checks

The application provides a health check endpoint at `/healthcheck`.

### Manual Check

```bash
curl https://your-domain.com/healthcheck
```

### Monitoring Integration

Configure your monitoring service to check:

- **Endpoint**: `https://your-domain.com/healthcheck`
- **Interval**: 30 seconds
- **Timeout**: 10 seconds
- **Expected Response**: `200 OK`

### Metrics Endpoint

Prometheus metrics available at `/metrics` (port 3010 by default):

```bash
curl http://localhost:3010/metrics
```

---

## Post-Deployment Verification

### 1. Health Check

```bash
curl https://your-domain.com/healthcheck
```

Should return `OK`.

### 2. Database Connection

```bash
pnpm exec prisma studio
```

### 3. Worker Process

Check worker logs:

```bash
pm2 logs smartflow-worker
# or
docker logs smartflow-worker
```

### 4. Queue System

Verify Redis connection and queues:

```bash
redis-cli -u $REDIS_URL ping
```

### 5. Storage

Test image upload functionality.

### 6. Nostr Integration

Test posting to Nostr.

---

## Scaling

### Horizontal Scaling

1. **Application Servers**: Deploy multiple instances behind a load balancer
2. **Worker Processes**: Scale workers independently based on queue load
3. **Database**: Use read replicas for read-heavy workloads
4. **Redis**: Use Redis Cluster for high availability

### Vertical Scaling

Increase resources (CPU, RAM) for:
- Database server
- Redis instance
- Application servers

### Load Balancing

Use a load balancer (nginx, HAProxy, AWS ALB) to distribute traffic:

```nginx
upstream smartflow {
    least_conn;
    server app1:3000;
    server app2:3000;
    server app3:3000;
}
```

---

## Troubleshooting

### Application Won't Start

1. Check environment variables
2. Verify database connection
3. Check logs: `pm2 logs` or `docker logs`
4. Verify port availability

### Worker Not Processing Jobs

1. Check Redis connection
2. Verify worker is running: `pm2 list`
3. Check worker logs
4. Verify queue configuration

### Database Connection Issues

1. Verify `DATABASE_URL` is correct
2. Check firewall rules
3. Verify database is accessible
4. Check connection pool settings

### High Memory Usage

1. Monitor with `pm2 monit`
2. Check for memory leaks
3. Increase server resources
4. Optimize database queries

---

## Additional Resources

- [Environment Setup Guide](./environment-setup.md)
- [Operations Guide](./operations.md)
- [Troubleshooting Guide](./troubleshooting.md)
- [Architecture Documentation](./architecture.md)




