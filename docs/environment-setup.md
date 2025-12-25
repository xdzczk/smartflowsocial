# Environment Setup

This comprehensive guide explains all environment variables required to run SmartFlowSocial, including configuration options, validation, troubleshooting, and platform-specific setup.

## Table of Contents

- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Detailed Configuration](#detailed-configuration)
- [Platform-Specific Setup](#platform-specific-setup)
- [Validation](#validation)
- [Troubleshooting](#troubleshooting)
- [Security Best Practices](#security-best-practices)

---

## Quick Start

### 1. Copy Example File

```bash
cp example.env .env
```

### 2. Edit Configuration

Open `.env` in your editor and configure all required variables.

### 3. Verify Setup

```bash
# Check environment variables are set
node -e "console.log(process.env.DATABASE_URL)"

# Or use a validation script
npm run validate-env
```

### 4. Start Application

```bash
npm run dev
```

## Environment Variables

### Required Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Random secret for session encryption |
| `NOSTR_PUBLISHER_URL` | HTTP Nostr Publisher service URL |
| `NOSTR_NSEC` | Nostr private key for server-side signing and DMs |
| `PRIMAL_CACHING_URL` | Primal caching service for profile/event lookups |
| `REDIS_URL` | Redis connection for job queues |

### Storage (Required for Image Uploads)

| Variable | Description |
|----------|-------------|
| `STORAGE_ACCESS_KEY` | S3-compatible storage access key |
| `STORAGE_SECRET` | S3-compatible storage secret key |
| `STORAGE_REGION` | Storage region (e.g., `us-east-1`) |
| `STORAGE_BUCKET` | Storage bucket name |
| `OWNER_NWC` | NWC string for receiving payments | - |
| `NODE_ENV` | Environment mode | `development` |

---

## Detailed Configuration

### DATABASE_URL

PostgreSQL connection string.

```env
DATABASE_URL=postgresql://user:password@localhost:5432/smartflow?schema=public
```

**Local Development with Docker:**
```bash
npm run docker  # Starts PostgreSQL container
# Use: DATABASE_URL=postgresql://postgres:postgres@localhost:5432/smartflow
```

**Production:**
Use a managed PostgreSQL service (Supabase, Railway, Render, etc.)

---

### SESSION_SECRET

Random string used to encrypt session cookies. Generate one using:

```bash
openssl rand -base64 32
```

```env
SESSION_SECRET=your-random-32-character-string-here
```

---

### NOSTR_PUBLISHER_URL

URL to your [HTTP Nostr Publisher](https://github.com/getAlby/http-nostr-publisher) instance.

This service handles signing and publishing Nostr events to relays.

```env
NOSTR_PUBLISHER_URL=https://your-publisher.example.com
```

**Setup:**
1. Deploy the HTTP Nostr Publisher service
2. Configure it with your Nostr private key
3. Point this variable to the service URL

---

### Storage Configuration

SmartFlowSocial supports S3-compatible storage for image uploads.

**For AWS S3:**
```env
STORAGE_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE
STORAGE_SECRET=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
STORAGE_REGION=us-east-1
STORAGE_BUCKET=my-smartflow-bucket
```

**For Cloudflare R2:**
```env
STORAGE_ACCESS_KEY=your-r2-access-key
STORAGE_SECRET=your-r2-secret-key
STORAGE_REGION=auto
STORAGE_BUCKET=your-bucket-name
```

**For MinIO (self-hosted):**
```env
STORAGE_ACCESS_KEY=minioadmin
STORAGE_SECRET=minioadmin
STORAGE_REGION=us-east-1
STORAGE_BUCKET=smartflow
```

---

### PRIMAL_CACHING_URL

WebSocket URL(s) to [Primal Caching Service](https://github.com/PrimalHQ/primal-caching-service) for profile and event lookups.

**Single endpoint:**
```env
PRIMAL_CACHING_URL=wss://your-primal-cache.example.com/v1
```

**Multiple endpoints (comma-separated):**
```env
PRIMAL_CACHING_URL=wss://cache1.example.com/v1,wss://cache2.example.com/v1
```

**If not set:** The app will use default public Primal cache endpoints:
- `wss://cache1.primal.net/v1`
- `wss://cache2.primal.net/v1`

> **Note:** These are public endpoints provided by Primal. For production use, consider setting up your own Primal cache instance or using a managed service.

**Required for:**
- Profile lookups and user metadata
- Event fetching and thread views
- Engagement feed functionality

---

### REDIS_URL

Redis connection for BullMQ job queues.

```env
REDIS_URL=redis://localhost:6379
```

**Required for:**
- Scheduled post processing
- Background job queue
- Worker process functionality

---

### OWNER_NWC 

Nostr Wallet Connect string for receiving subscription payments.

```env
OWNER_NWC=nostr+walletconnect://pubkey?relay=wss://relay.example.com&secret=...
```

**How to get:**
1. Use a Lightning wallet that supports NWC (Alby, Mutiny, etc.)
2. Generate a connection string from your wallet
3. Set it as this environment variable

**Required for:**
- Accepting Lightning payments for subscriptions

---

### NODE_ENV

Application environment mode.

```env
NODE_ENV=development  # For local development
NODE_ENV=production   # For production deployment
```

---

### NOSTR_NSEC

Nostr secret key for server-side event signing and sending DMs.

```env
NOSTR_NSEC=nsec1...
```

> ⚠️ **Security Warning:** Keep this secret! Never commit to version control.

**Required for:**
- Sending subscription-related Nostr DMs
- Server-side event signing when user extension isn't available

---

## Example Complete Configuration

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/smartflow

# Session
SESSION_SECRET=your-super-secret-session-key-here

# Nostr Publisher
NOSTR_PUBLISHER_URL=https://publisher.example.com
NOSTR_NSEC=nsec1...

# Primal Cache (supports comma-separated endpoints for redundancy)
PRIMAL_CACHING_URL=wss://cache.example.com/v1
# Or multiple: PRIMAL_CACHING_URL=wss://cache1.example.com/v1,wss://cache2.example.com/v1

# Redis for queues
REDIS_URL=redis://localhost:6379

# S3 Storage
STORAGE_ACCESS_KEY=your-access-key
STORAGE_SECRET=your-secret-key
STORAGE_REGION=us-east-1
STORAGE_BUCKET=smartflow-uploads

# Payments (optional)
OWNER_NWC=nostr+walletconnect://...

# Environment
NODE_ENV=development

# Server signing (optional)
NOSTR_NSEC=nsec1...
```

## Verifying Setup

After configuring your environment:

```bash
# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Seed initial data
npm run db:seed

# Start development server
npm run dev
```

The app should be running at http://localhost:3000

---

## Platform-Specific Setup

### Local Development

**Using Docker Compose:**

```bash
# Start PostgreSQL and Redis
npm run docker

# Use these connection strings:
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/smartflow
REDIS_URL=redis://localhost:6379
```

**Using Local Services:**

```bash
# Install PostgreSQL and Redis locally
# Then configure:
DATABASE_URL=postgresql://user:password@localhost:5432/smartflow
REDIS_URL=redis://localhost:6379
```

### Production Platforms

#### Fly.io

```bash
# Set secrets
fly secrets set DATABASE_URL="postgresql://..."
fly secrets set SESSION_SECRET="..."
# ... other secrets
```

#### Railway

Configure in Railway dashboard → Variables section.

#### Vercel

Configure in Vercel dashboard → Settings → Environment Variables.

#### AWS/EC2

```bash
# Use .env file or environment variables
export DATABASE_URL="postgresql://..."
export SESSION_SECRET="..."
```

---

## Validation

### Required Variables Checklist

- [ ] `DATABASE_URL` - PostgreSQL connection string
- [ ] `SESSION_SECRET` - Session encryption secret
- [ ] `NOSTR_PUBLISHER_URL` - HTTP Nostr Publisher URL
- [ ] `REDIS_URL` - Redis connection string
- [ ] `STORAGE_ACCESS_KEY` - Storage access key
- [ ] `STORAGE_SECRET` - Storage secret key
- [ ] `STORAGE_REGION` - Storage region
- [ ] `STORAGE_BUCKET` - Storage bucket name

### Optional Variables

- [ ] `NOSTR_NSEC` - Server-side signing key
- [ ] `PRIMAL_CACHING_URL` - Primal cache URL
- [ ] `OWNER_NWC` - Payment receiving NWC
- [ ] `METRICS_PORT` - Metrics port (default: 3010)

### Validation Script

Create `scripts/validate-env.js`:

```javascript
const required = [
  'DATABASE_URL',
  'SESSION_SECRET',
  'NOSTR_PUBLISHER_URL',
  'REDIS_URL',
];

const missing = required.filter(key => !process.env[key]);

if (missing.length > 0) {
  console.error('❌ Missing required environment variables:');
  missing.forEach(key => console.error(`  - ${key}`));
  process.exit(1);
}

console.log('✅ All required environment variables are set');
```

Run: `node scripts/validate-env.js`

---

## Troubleshooting

### Database Connection Issues

**Problem:** Can't connect to database

**Solutions:**
1. Verify `DATABASE_URL` format: `postgresql://user:pass@host:port/db`
2. Check database is running: `pg_isready -h localhost`
3. Verify credentials are correct
4. Check firewall rules
5. Test connection: `psql $DATABASE_URL`

### Redis Connection Issues

**Problem:** Can't connect to Redis

**Solutions:**
1. Verify `REDIS_URL` format: `redis://host:port`
2. Check Redis is running: `redis-cli ping`
3. Verify credentials if using auth
4. Check network connectivity
5. Test connection: `redis-cli -u $REDIS_URL ping`

### Storage Configuration Issues

**Problem:** Image uploads fail

**Solutions:**
1. Verify storage credentials
2. Check bucket exists and is accessible
3. Verify IAM permissions (for AWS S3)
4. Test upload manually
5. Check CORS configuration (if needed)

### Nostr Publisher Issues

**Problem:** Posts not publishing

**Solutions:**
1. Verify `NOSTR_PUBLISHER_URL` is correct
2. Test publisher endpoint: `curl $NOSTR_PUBLISHER_URL/health`
3. Check publisher is running
4. Verify publisher configuration
5. Check network connectivity

### Session Secret Issues

**Problem:** Sessions not persisting

**Solutions:**
1. Verify `SESSION_SECRET` is set
2. Check secret is at least 32 characters
3. Ensure secret is consistent across restarts
4. Clear browser cookies
5. Check cookie settings

---

## Security Best Practices

### Secret Management

1. **Never Commit Secrets**
   - Add `.env` to `.gitignore`
   - Use `.env.example` for templates
   - Never commit actual secrets

2. **Use Strong Secrets**
   ```bash
   # Generate strong session secret
   openssl rand -base64 32
   ```

3. **Rotate Secrets Regularly**
   - Session secrets: Every 90 days
   - Database passwords: Every 180 days
   - API keys: As needed

4. **Use Secret Management Services**
   - AWS Secrets Manager
   - HashiCorp Vault
   - Platform-specific secret stores

### Environment-Specific Configuration

**Development:**
- Use local services
- Less strict security
- Debug logging enabled

**Production:**
- Use managed services
- Strict security
- Minimal logging
- HTTPS only

### Validation

Always validate environment variables:

```typescript
// Validate required variables
const required = ['DATABASE_URL', 'SESSION_SECRET'];
required.forEach(key => {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
});
```

---

## Additional Resources

- [Deployment Guide](./DEPLOYMENT.md) - Production deployment
- [Security Guide](./SECURITY.md) - Security best practices
- [Troubleshooting Guide](./TROUBLESHOOTING.md) - Common issues
- [Architecture Documentation](./architecture.md) - System architecture
